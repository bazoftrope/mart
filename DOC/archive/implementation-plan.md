# План пошаговой реализации MVP

## Фиксированные решения

- **Фреймворк:** Next.js 14, **Pages Router**
- **Стили:** чистый CSS (CSS Modules + глобальные переменные + utility-классы в `globals.css`), без Tailwind
- **Язык:** TypeScript
- **База данных:** PostgreSQL
- **ORM:** Sequelize + sequelize-typescript
- **Аутентификация:** JWT в httpOnly-cookie
- **Хостинг:** Timeweb Cloud

---

## Подготовка окружения

1. Создать проект Next.js в папке `marathon-platform`.
2. Перенести текущую папку `DOC` внутрь `marathon-platform/DOC`.
3. Поднять PostgreSQL локально через `docker-compose.yml`.
4. Настроить `.env.local` и `.env.example`.
5. Установить дополнительные зависимости: `sequelize`, `sequelize-typescript`, `pg`, `jsonwebtoken`, `bcrypt`, `zod`, `date-fns`, `date-fns-tz`, `recharts`, `lucide-react`.
6. Настроить алиасы `@/*` и базовую структуру папок (`src/pages`, `src/components`, `src/lib`, `src/models`, `src/types`, `migrations`, `seeders`).

---

## Шаг 1. База данных: модели и миграции [v]

**Цель:** работающая схема БД со связями.

- Создать модели Sequelize TypeScript:
  - `User`
  - `Product`
  - `MarathonTemplate`
  - `TemplateDay`
  - `Stream`
  - `StreamEnrollment`
  - `DailyReport`
  - `ReportLine`
  - `StreamRating`
- Настроить связи в `src/models/index.ts`.
- Создать миграции Sequelize CLI для всех таблиц.
- Создать seeder с базовыми продуктами.
- Проверить: `npx sequelize-cli db:migrate` и `npx sequelize-cli db:seed:all` проходят без ошибок.

**Критерий готовности:** можно зайти в PostgreSQL и увидеть все таблицы с индексами.

---

## Шаг 2. Авторизация [v]

**Цель:** пользователь может зарегистрироваться, войти и выйти.

- Сервис JWT: генерация access/refresh токенов, установка httpOnly cookie.
- Middleware `withAuth`, `withRole`, `withAdmin`.
- API routes:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/auth/refresh`
- Страницы:
  - `/login`
  - `/register`
- Проверка роли админа по `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` из env.

**Критерий готовности:** регистрация и вход работают, куки ставятся, роли различаются.

---

## Шаг 3. Базовая API-обвёртка [v]

**Цель:** единый стиль обработки запросов и ошибок.

- `src/lib/apiHandler.ts` — маршрутизация методов, try/catch, CORS.
- `src/lib/errors.ts` — классы ошибок: `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`.
- `src/lib/validate.ts` — Zod-схемы для общих полей.
- Формат ответа:
  ```json
  { "success": true, "data": ... }
  { "success": false, "error": "...", "message": "..." }
  ```

**Критерий готовности:** любой endpoint возвращает единый формат, ошибки имеют правильные HTTP-статусы.

---

## Шаг 4. Админ-панель и база продуктов [v]

**Цель:** админ может войти и увидеть марафоны на проверке; в БД есть продукты.

- Seed продуктов (яйца, курица, помидоры и т.д.).
- API:
  - `GET /api/admin/pending` — список шаблонов на проверке.
  - `GET /api/admin/pending/[id]` — детали шаблона.
  - `POST /api/admin/[id]/approve` — одобрить шаблон.
- Страница `/admin/index.tsx` — список на проверке.
- Страница `/admin/[id].tsx` — просмотр шаблона и кнопка «Одобрить».
- API для поиска продуктов: `GET /api/products?search=...`.

**Критерий готовности:** админ видит шаблоны, может одобрить, продукты ищутся.

---

## Шаг 5. Ментор: шаблоны и дни [v]

**Цель:** ментор создаёт и редактирует марафон-шаблон.

- API:
  - `GET /api/marathons` — список шаблонов ментора.
  - `POST /api/marathons` — создать шаблон.
  - `GET /api/marathons/[id]` — шаблон по ID.
  - `PUT /api/marathons/[id]` — редактировать.
  - `DELETE /api/marathons/[id]` — удалить (только draft).
  - `POST /api/marathons/[id]/submit` — отправить на проверку.
  - `GET /api/marathons/[id]/days` — дни шаблона.
  - `POST /api/marathons/[id]/days` — создать/обновить дни.
- Страницы:
  - `/mentor/index.tsx` — дашборд ментора.
  - `/mentor/templates/index.tsx` — список шаблонов.
  - `/mentor/templates/new.tsx` — создание шаблона (шаг 1).
  - `/mentor/templates/[id]/edit.tsx` — редактирование основной инфо.
  - `/mentor/templates/[id]/days.tsx` — управление днями.

**Критерий готовности:** ментор может создать шаблон, добавить дни, отправить на проверку.

---

## Шаг 6. Потоки и запись участников [v]

**Цель:** ментор запускает поток, участник записывается.

- API:
  - `POST /api/streams` — создать поток из approved-шаблона.
  - `GET /api/streams` — публичный список открытых потоков.
  - `GET /api/streams/my` — потоки текущего пользователя.
  - `GET /api/streams/[id]` — детали потока.
  - `POST /api/streams/[id]/enroll` — записаться на поток.
- Страницы:
  - `/index.tsx` — главная с публичными потоками.
  - `/streams/[id]/index.tsx` — страница потока с кнопкой «Записаться».
  - `/mentor/streams/index.tsx` — потоки ментора.
  - `/mentor/streams/[id]/index.tsx` — страница потока для ментора.
  - `/mentor/streams/[id]/launch.tsx` — форма запуска потока.

**Критерий готовности:** участник видит потоки, записывается; ментор запускает поток.

---

## Шаг 7. Участник: календарь и отчёты [v]

**Цель:** участник проходит марафон, заполняет отчёты, считаются калории.

- API:
  - `GET /api/streams/[id]/day/[dayNumber]` — материалы дня и текущий отчёт.
  - `POST /api/streams/[id]/day/[dayNumber]` — сохранить отчёт.
  - `PUT /api/reports/[reportId]` — редактировать отчёт.
- Страницы:
  - `/dashboard/index.tsx` — «Мои марафоны».
  - `/dashboard/marathon/[streamId]/index.tsx` — календарь дней.
  - `/dashboard/marathon/[streamId]/day/[dayNumber].tsx` — день + форма отчёта.
- Компоненты:
  - `CalendarGrid`
  - `ReportTable`
  - `ProductSearch`
- Расчёт калорий:
  - `line_calories = weight_grams × calories_per_100g / 100`
  - `total_calories = SUM(line_calories)`

**Критерий готовности:** участник открывает день, добавляет продукты, видит итоговые калории, сохраняет отчёт.

---

## Шаг 8. Рейтинг

**Цель:** ежедневный пересчёт рейтинга по дисциплине.

- `src/lib/ratingCalculator.ts`:
  - Для каждого потока `running` или `finished`.
  - Считает `filled_days` для каждого участника.
  - Считает `discipline_percent = filled_days / duration_days × 100`.
  - Сортирует и назначает `rank`.
  - Сохраняет в `StreamRating` через upsert.
- API:
  - `GET /api/streams/[id]/rating` — таблица рейтинга.
  - `POST /api/rating/calculate` — ручной пересчёт (admin only).
- Страница:
  - `/dashboard/marathon/[streamId]/rating.tsx` — рейтинг участника.
- Cron:
  - Локально: `node-cron`.
  - На Timeweb: внешний cron или отдельный скрипт.

**Критерий готовности:** рейтинг обновляется, участник видит своё место.

---

## Шаг 9. Результаты и графики

**Цель:** после финиша участник видит сводку и график.

- API:
  - `GET /api/streams/[id]/results` — данные для страницы результатов.
- Страница:
  - `/dashboard/marathon/[streamId]/results.tsx`
- График:
  - Recharts: линия калорий участника по дням.
  - Линия средних калорий по потоку.
- Сводка:
  - Дисциплина, место, средние калории.

**Критерий готовности:** после финиша открывается страница результатов с графиком.

---

## Шаг 10. Деплой

**Цель:** приложение работает на Timeweb Cloud.

- `next.config.js`:
  - `output: 'standalone'`
  - `env` для DB и JWT секретов.
- `docker-compose.yml` для локальной разработки.
- Инструкция по деплою:
  1. Пуш в репозиторий.
  2. Timeweb билдит `npm ci && npm run build`.
  3. Стартует `node .next/standalone/server.js`.
  4. Применяем миграции.
  5. Первичный seed продуктов.
- Настройка cron для ежедневного пересчёта рейтинга.

**Критерий готовности:** продакшен доступен, миграции и seed применены.

---

## Порядок запуска в новой сессии

Когда начинаешь новую сессию, передай агенту:

> Платформа марафонов по здоровому питанию. Next.js 14 + Pages Router + TypeScript, чистый CSS (CSS Modules + utility-классы в `globals.css`), PostgreSQL, Sequelize. Проект в `/Users/bazoftrope/projects/Irina/marafon/marathon-platform`. Документация в `DOC/`. Начинаем реализацию по плану `DOC/implementation-plan.md`, шаг N.
