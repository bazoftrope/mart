#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ubuntu/marathon-platform"
BRANCH="main"
REPO_API="https://api.github.com/repos/bazoftrope/mart"
LOG_FILE="/home/ubuntu/marathon-auto-deploy.log"
LOCK_FILE="/tmp/marathon-auto-deploy.lock"
STATE_DIR="/home/ubuntu/marathon-deploy"
DEPLOYED_SHA_FILE="$STATE_DIR/deployed.sha"
FAILED_STATE_FILE="$STATE_DIR/failed.state"
LOG_MAX_BYTES=$((10 * 1024 * 1024))
RETRY_COOLDOWN_SECONDS=600
MIN_FREE_KB=$((8 * 1024 * 1024))

log() {
  echo "$(date -Is) $*" >> "$LOG_FILE"
}

rotate_log() {
  if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE")" -gt "$LOG_MAX_BYTES" ]; then
    mv -f "$LOG_FILE" "$LOG_FILE.1"
  fi
}

free_disk_if_needed() {
  local avail
  avail=$(df -Pk "$REPO_DIR" | awk 'NR==2 {print $4}')
  if [ "$avail" -ge "$MIN_FREE_KB" ]; then
    return 0
  fi
  log "low disk space: ${avail}KB free, cleaning up"
  docker builder prune -af >> "$LOG_FILE" 2>&1 || true
  sudo -n journalctl --vacuum-size=200M >> "$LOG_FILE" 2>&1 || true
  sudo -n apt-get clean >> "$LOG_FILE" 2>&1 || true
}

mkdir -p "$STATE_DIR"
rotate_log

# Prevent overlapping deploys (cron runs every minute, build may take several minutes).
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "deploy already running, skip"
  exit 0
fi

cd "$REPO_DIR"

if ! git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "git fetch failed, will retry"
  exit 0
fi

REMOTE_SHA=$(git rev-parse "origin/$BRANCH")
DEPLOYED_SHA=$(cat "$DEPLOYED_SHA_FILE" 2>/dev/null || true)

if [ "$DEPLOYED_SHA" = "$REMOTE_SHA" ]; then
  exit 0
fi

# Do not hammer a commit that just failed to build; retry after a cooldown.
if [ -f "$FAILED_STATE_FILE" ]; then
  read -r FAILED_SHA FAILED_TS < "$FAILED_STATE_FILE" || true
  if [ "${FAILED_SHA:-}" = "$REMOTE_SHA" ]; then
    NOW=$(date +%s)
    if [ $((NOW - ${FAILED_TS:-0})) -lt "$RETRY_COOLDOWN_SECONDS" ]; then
      exit 0
    fi
  fi
fi

# Deploy only after GitHub Actions CI job has passed.
CI_STATE=$(curl -fsS "$REPO_API/commits/$REMOTE_SHA/check-runs" | python3 -c '
import json, sys

data = json.load(sys.stdin)
name = "Lint and build"
conclusions = [
    run.get("conclusion")
    for run in data.get("check_runs", [])
    if run.get("name") == name and run.get("status") == "completed"
]
print(conclusions[-1] if conclusions else "pending")
' 2>/dev/null) || CI_STATE="unavailable"

if [ "$CI_STATE" != "success" ]; then
  log "CI state is '$CI_STATE', deploy postponed"
  exit 0
fi

log "CI passed, deploying ${DEPLOYED_SHA:-none} -> $REMOTE_SHA"

free_disk_if_needed

git checkout -f "$BRANCH" 2>/dev/null || git checkout -f -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

log "docker compose build..."
if ! docker compose build >> "$LOG_FILE" 2>&1; then
  log "build failed, will retry in ${RETRY_COOLDOWN_SECONDS}s"
  echo "$REMOTE_SHA $(date +%s)" > "$FAILED_STATE_FILE"
  exit 1
fi

log "docker compose up -d..."
if ! docker compose up -d >> "$LOG_FILE" 2>&1; then
  log "docker compose up failed, will retry in ${RETRY_COOLDOWN_SECONDS}s"
  echo "$REMOTE_SHA $(date +%s)" > "$FAILED_STATE_FILE"
  exit 1
fi

echo "$REMOTE_SHA" > "$DEPLOYED_SHA_FILE"
rm -f "$FAILED_STATE_FILE"
log "deploy finished: $REMOTE_SHA"
