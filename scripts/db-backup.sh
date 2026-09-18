#!/usr/bin/env bash
#
# db-backup.sh — резервное копирование и восстановление БД marathon_platform.
#
# Подкоманды:
#   backup [--dry-run]         сделать дамп (по умолчанию)
#   list                       показать имеющиеся дампы
#   restore [<файл>] [--yes]   восстановить БД из дампа (по умолчанию — самый свежий)
#   install-cron [--dry-run]   добавить ежедневный бэкап в crontab пользователя
#   uninstall-cron             убрать задачу из crontab
#   help                       эта справка
#
# Подключение определяется автоматически:
#   1) docker compose (сервис db в docker-compose.yml) — прод;
#   2) docker exec в контейнер marathon-postgres;
#   3) локальный pg_dump/psql + DATABASE_URL — локальная разработка.
#
# Гарантия сохранности: новый дамп пишется во временный файл, проверяется
# (не пустой, gzip цел, есть маркер завершения pg_dump) и только затем
# атомарно занимает место в каталоге бэкапов. Если дамп не удался — старая
# копия остаётся нетронутой. Число хранимых копий задаётся BACKUP_KEEP
# (по умолчанию 1 — одна перезаписываемая копия).
#
# Подробнее: DOC/architecture.md → «Резервное копирование БД».
#
set -euo pipefail

# Cron запускает задачи с урезанным PATH — дополняем его сами.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
# Дампы содержат ПДн — новые файлы по умолчанию только для владельца.
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CRON_MARKER="# marathon-db-backup"
SCRIPT_PATH="$SCRIPT_DIR/db-backup.sh"

LOCK_DIR=""
TMP_FILE=""

# --------------------------------------------------------------- настройки ---

# Читает KEY=VALUE из файла в окружение, не перетирая уже заданные переменные.
load_env_file() {
  local file="$1" line key value
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      '' | '#'*) continue ;;
    esac
    key="$(printf '%s' "${line%%=*}" | tr -d '[:space:]')"
    if [ -z "$key" ]; then
      continue
    fi
    # Значение уже задано снаружи — не переопределяем.
    if [ -n "${!key-}" ]; then
      continue
    fi
    value="${line#*=}"
    export "$key=$value"
  done <"$file"
}

load_env_file "$REPO_DIR/.env.local"
load_env_file "$REPO_DIR/.env"

BACKUP_DIR="${BACKUP_DIR:-$HOME/marathon-backups}"
BACKUP_KEEP="${BACKUP_KEEP:-1}"
BACKUP_PREFIX="${BACKUP_PREFIX:-marathon_platform}"
BACKUP_LOG="${BACKUP_LOG:-$BACKUP_DIR/backup.log}"
BACKUP_CRON="${BACKUP_CRON:-0 3 * * *}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-marathon-postgres}"
# Путь к crontab — вынесен, чтобы можно было подменить в тестах или нестандартной среде.
CRONTAB_BIN="${CRONTAB_BIN:-crontab}"

# BACKUP_KEEP — целое положительное число.
case "$BACKUP_KEEP" in
  '' | *[!0-9]*) BACKUP_KEEP=1 ;;
esac
if [ "$BACKUP_KEEP" -lt 1 ]; then
  BACKUP_KEEP=1
fi

# Извлекает user или db из DATABASE_URL. Печатает значение или возвращает 1.
url_component() {
  local url="${DATABASE_URL:-}" part="$1" rest creds hostpart
  [ -n "$url" ] || return 1
  rest="${url#*://}"
  case "$rest" in
    *@*)
      creds="${rest%%@*}"
      hostpart="${rest#*@}"
      ;;
    *)
      creds=""
      hostpart="$rest"
      ;;
  esac
  case "$part" in
    user)
      if [ -z "$creds" ]; then
        return 1
      fi
      printf '%s' "${creds%%:*}"
      ;;
    db)
      hostpart="${hostpart%%\?*}"
      case "$hostpart" in
        */*) printf '%s' "${hostpart#*/}" ;;
        *) return 1 ;;
      esac
      ;;
    *)
      return 1
      ;;
  esac
}

DB_NAME="${DB_NAME:-}"
if [ -z "$DB_NAME" ]; then
  DB_NAME="$(url_component db || true)"
fi
if [ -z "$DB_NAME" ]; then
  DB_NAME="${POSTGRES_DB:-marathon_platform}"
fi

DB_USER="${DB_USER:-}"
if [ -z "$DB_USER" ]; then
  DB_USER="$(url_component user || true)"
fi
if [ -z "$DB_USER" ]; then
  DB_USER="${POSTGRES_USER:-marathon}"
fi

if ! printf '%s' "$DB_NAME" | grep -qE '^[A-Za-z0-9_-]+$'; then
  printf 'Некорректное имя базы данных: "%s"\n' "$DB_NAME" >&2
  exit 1
fi

# ------------------------------------------------------------------- утилы ---

log() {
  local line
  line="$(date '+%Y-%m-%dT%H:%M:%S%z') $*"
  printf '%s\n' "$line"
  if [ -n "$BACKUP_LOG" ] && [ -d "$(dirname "$BACKUP_LOG")" ]; then
    printf '%s\n' "$line" >>"$BACKUP_LOG"
  fi
}

# Определяет способ подключения к БД: compose | docker | local.
resolve_mode() {
  if [ -f "$REPO_DIR/docker-compose.yml" ] && command -v docker >/dev/null 2>&1; then
    if [ -n "$(docker compose -f "$REPO_DIR/docker-compose.yml" ps -q "$DB_SERVICE" 2>/dev/null || true)" ]; then
      printf 'compose'
      return 0
    fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)" = "true" ]; then
      printf 'docker'
      return 0
    fi
  fi
  if command -v pg_dump >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
    printf 'local'
    return 0
  fi
  return 1
}

dump_db() {
  local mode="$1"
  case "$mode" in
    compose)
      docker compose -f "$REPO_DIR/docker-compose.yml" exec -T "$DB_SERVICE" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges
      ;;
    docker)
      docker exec -i "$DB_CONTAINER" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges
      ;;
    local)
      pg_dump "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges
      ;;
  esac
}

restore_db() {
  local mode="$1"
  case "$mode" in
    compose)
      docker compose -f "$REPO_DIR/docker-compose.yml" exec -T "$DB_SERVICE" \
        psql -q -v ON_ERROR_STOP=1 --single-transaction -U "$DB_USER" -d "$DB_NAME"
      ;;
    docker)
      docker exec -i "$DB_CONTAINER" \
        psql -q -v ON_ERROR_STOP=1 --single-transaction -U "$DB_USER" -d "$DB_NAME"
      ;;
    local)
      psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 --single-transaction
      ;;
  esac
}

acquire_lock() {
  LOCK_DIR="$BACKUP_DIR/.lock"
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s' "$$" >"$LOCK_DIR/pid"
    return 0
  fi
  local old_pid=""
  if [ -f "$LOCK_DIR/pid" ]; then
    old_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  fi
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    return 1
  fi
  # Lock остался от упавшего процесса — снимаем.
  rm -rf "$LOCK_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    return 1
  fi
  printf '%s' "$$" >"$LOCK_DIR/pid"
  return 0
}

release_lock() {
  if [ -n "$LOCK_DIR" ]; then
    rm -rf "$LOCK_DIR"
  fi
  return 0
}

cleanup() {
  release_lock
  if [ -n "$TMP_FILE" ]; then
    rm -f "$TMP_FILE"
  fi
}

# Удаляет самые старые дампы, оставляя BACKUP_KEEP штук.
prune_backups() {
  local i=0 removed=0 file
  while IFS= read -r file; do
    if [ -z "$file" ]; then
      continue
    fi
    i=$((i + 1))
    if [ "$i" -gt "$BACKUP_KEEP" ]; then
      if rm -f -- "$file"; then
        removed=$((removed + 1))
      fi
    fi
  done < <(ls -1t "$BACKUP_DIR"/"${BACKUP_PREFIX}"_*.sql.gz 2>/dev/null || true)
  if [ "$removed" -gt 0 ]; then
    log "Удалено старых копий: $removed (храним $BACKUP_KEEP)"
  fi
}

# Обрезает лог, чтобы он не рос бесконечно.
trim_log() {
  [ -f "$BACKUP_LOG" ] || return 0
  local size
  size="$(wc -c <"$BACKUP_LOG" | tr -d '[:space:]')"
  if [ -n "$size" ] && [ "$size" -gt 524288 ]; then
    tail -n 500 "$BACKUP_LOG" >"$BACKUP_LOG.tmp"
    mv "$BACKUP_LOG.tmp" "$BACKUP_LOG"
    chmod 600 "$BACKUP_LOG"
  fi
}

# --------------------------------------------------------------- подкоманды ---

cmd_backup() {
  local dry_run="$1" mode stamp final size

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  if ! acquire_lock; then
    log "Бэкап уже выполняется (lock: $LOCK_DIR) — пропуск"
    return 0
  fi
  trap cleanup EXIT

  if ! mode="$(resolve_mode)"; then
    log "ОШИБКА: не найден способ подключения к БД (нет docker compose, контейнера $DB_CONTAINER и локального pg_dump/DATABASE_URL)"
    return 1
  fi

  stamp="$(date '+%Y-%m-%d_%H%M%S')"
  final="$BACKUP_DIR/${BACKUP_PREFIX}_${stamp}.sql.gz"

  if [ "$dry_run" = "1" ]; then
    log "[dry-run] режим=$mode, БД=$DB_NAME, будет создан $final"
    return 0
  fi

  log "Старт бэкапа: режим=$mode, БД=$DB_NAME, каталог=$BACKUP_DIR, храним=$BACKUP_KEEP"
  TMP_FILE="$BACKUP_DIR/.${BACKUP_PREFIX}_${stamp}.sql.gz.tmp"

  if ! dump_db "$mode" | gzip -9 >"$TMP_FILE"; then
    log "ОШИБКА: pg_dump завершился с ошибкой — старая копия не тронута"
    return 1
  fi

  if [ ! -s "$TMP_FILE" ]; then
    log "ОШИБКА: дамп пустой — старая копия не тронута"
    return 1
  fi
  if ! gzip -t "$TMP_FILE" 2>/dev/null; then
    log "ОШИБКА: дамп повреждён (проверка gzip) — старая копия не тронута"
    return 1
  fi
  if ! gzip -dc "$TMP_FILE" | tail -n 20 | grep -q 'PostgreSQL database dump complete'; then
    log "ОШИБКА: в дампе нет маркера завершения pg_dump — старая копия не тронута"
    return 1
  fi

  # Атомарная замена: файл уже проверен, только теперь попадает в каталог.
  chmod 600 "$TMP_FILE"
  mv -f "$TMP_FILE" "$final"
  TMP_FILE=""

  size="$(du -h "$final" | cut -f1)"
  log "Дамп сохранён: $final ($size)"
  prune_backups
  trim_log
  return 0
}

cmd_list() {
  if [ ! -d "$BACKUP_DIR" ]; then
    log "Каталог бэкапов не найден: $BACKUP_DIR"
    return 0
  fi
  local found=0 file size
  while IFS= read -r file; do
    if [ -z "$file" ]; then
      continue
    fi
    found=1
    size="$(du -h "$file" | cut -f1)"
    printf '%8s  %s\n' "$size" "$(basename "$file")"
  done < <(ls -1t "$BACKUP_DIR"/"${BACKUP_PREFIX}"_*.sql.gz 2>/dev/null || true)
  if [ "$found" = "0" ]; then
    printf 'Дампов нет в %s\n' "$BACKUP_DIR"
  fi
}

cmd_restore() {
  local file="$1" assume_yes="$2" mode answer=""

  if [ -z "$file" ]; then
    file="$(ls -1t "$BACKUP_DIR"/"${BACKUP_PREFIX}"_*.sql.gz 2>/dev/null | head -n 1 || true)"
  fi
  if [ -z "$file" ] || [ ! -f "$file" ]; then
    log "ОШИБКА: файл дампа не найден: ${file:-<в $BACKUP_DIR нет дампов>}"
    return 1
  fi
  if ! gzip -t "$file" 2>/dev/null; then
    log "ОШИБКА: файл повреждён (проверка gzip): $file"
    return 1
  fi

  if ! mode="$(resolve_mode)"; then
    log "ОШИБКА: не найден способ подключения к БД"
    return 1
  fi

  log "ВНИМАНИЕ: восстановление перезапишет данные в БД \"$DB_NAME\" (режим: $mode) из $file"
  log "Перед восстановлением рекомендуется остановить приложение."

  if [ "$assume_yes" != "1" ]; then
    if [ ! -t 0 ]; then
      log "ОШИБКА: неинтерактивный запуск — добавьте --yes для подтверждения"
      return 1
    fi
    printf 'Продолжить? Введите "yes": ' >&2
    read -r answer || answer=""
    if [ "$answer" != "yes" ]; then
      log "Восстановление отменено пользователем"
      return 1
    fi
  fi

  if ! gzip -dc "$file" | restore_db "$mode"; then
    log "ОШИБКА: восстановление завершилось с ошибкой"
    return 1
  fi
  log "Восстановление завершено: $file"
  return 0
}

cmd_install_cron() {
  local dry_run="$1" line current tmp

  if ! command -v "$CRONTAB_BIN" >/dev/null 2>&1; then
    log "ОШИБКА: не найдена команда crontab (CRONTAB_BIN=$CRONTAB_BIN)"
    return 1
  fi

  line="$BACKUP_CRON $SCRIPT_PATH backup >> $BACKUP_DIR/cron.log 2>&1 $CRON_MARKER"

  if [ "$dry_run" = "1" ]; then
    printf '%s\n' "$line"
    return 0
  fi

  chmod +x "$SCRIPT_PATH" 2>/dev/null || true
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  current="$("$CRONTAB_BIN" -l 2>/dev/null || true)"
  tmp="$(mktemp)"
  printf '%s\n' "$current" | grep -v -F "$CRON_MARKER" | grep -v '^$' >"$tmp" || true
  printf '%s\n' "$line" >>"$tmp"
  "$CRONTAB_BIN" "$tmp"
  rm -f "$tmp"

  log "Задача добавлена в crontab:"
  log "  $line"
}

cmd_uninstall_cron() {
  local current tmp

  if ! command -v "$CRONTAB_BIN" >/dev/null 2>&1; then
    log "ОШИБКА: не найдена команда crontab (CRONTAB_BIN=$CRONTAB_BIN)"
    return 1
  fi

  current="$("$CRONTAB_BIN" -l 2>/dev/null || true)"
  if ! printf '%s\n' "$current" | grep -q -F "$CRON_MARKER"; then
    log "Задача не найдена в crontab — нечего удалять"
    return 0
  fi

  tmp="$(mktemp)"
  printf '%s\n' "$current" | grep -v -F "$CRON_MARKER" >"$tmp" || true
  "$CRONTAB_BIN" "$tmp"
  rm -f "$tmp"

  log "Задача удалена из crontab"
}

usage() {
  cat <<'EOF'
Использование: scripts/db-backup.sh <команда> [аргументы]

  backup [--dry-run]         сделать дамп БД (действие по умолчанию)
  list                       показать имеющиеся дампы
  restore [<файл>] [--yes]   восстановить БД (по умолчанию — самый свежий дамп)
  install-cron [--dry-run]   добавить ежедневный бэкап в crontab
  uninstall-cron             убрать задачу из crontab
  help                       эта справка

Переменные окружения (можно задать в .env.local или .env):
  BACKUP_DIR     каталог для дампов (по умолчанию $HOME/marathon-backups)
  BACKUP_KEEP    сколько последних дампов хранить (по умолчанию 1)
  BACKUP_CRON    расписание cron для install-cron (по умолчанию "0 3 * * *")
EOF
}

main() {
  local cmd="${1:-backup}"
  if [ $# -gt 0 ]; then
    shift
  fi

  case "$cmd" in
    backup)
      local dry=0 arg
      for arg in "$@"; do
        case "$arg" in
          --dry-run) dry=1 ;;
          *)
            printf 'Неизвестный аргумент: %s\n' "$arg" >&2
            exit 2
            ;;
        esac
      done
      cmd_backup "$dry"
      ;;
    list)
      cmd_list
      ;;
    restore)
      local file="" yes=0 arg
      for arg in "$@"; do
        case "$arg" in
          --yes) yes=1 ;;
          -*)
            printf 'Неизвестный аргумент: %s\n' "$arg" >&2
            exit 2
            ;;
          *)
            if [ -z "$file" ]; then
              file="$arg"
            else
              printf 'Указано больше одного файла\n' >&2
              exit 2
            fi
            ;;
        esac
      done
      cmd_restore "$file" "$yes"
      ;;
    install-cron)
      local dry=0 arg
      for arg in "$@"; do
        case "$arg" in
          --dry-run) dry=1 ;;
          *)
            printf 'Неизвестный аргумент: %s\n' "$arg" >&2
            exit 2
            ;;
        esac
      done
      cmd_install_cron "$dry"
      ;;
    uninstall-cron)
      cmd_uninstall_cron
      ;;
    help | -h | --help)
      usage
      ;;
    *)
      printf 'Неизвестная команда: %s\n\n' "$cmd" >&2
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
