# Marathon Platform — карта проекта для агента

Начни отсюда в каждой сессии. Это начальный указатель; при необходимости дочитывай полные документы из `DOC/`.

## О проекте

Платформа управления марафонами похудения: участники, наставники (mentors), админы, потоки марафонов, ежедневные отчёты, рейтинг, калорийность, чат, общая книга рецептов и книга тренировок.

- **Стек:** Next.js 14 (**Pages Router**, не App Router), React 18, TypeScript (strict)
- **База данных:** PostgreSQL + Sequelize (Sequelize-TS, декораторы)
- **Стили:** CSS Modules + глобальные переменные, **без Tailwind**
- **Auth:** JWT (access/refresh) через куки; crud-роли: `admin`, `mentor`, `participant`
- **Состояние клиента:** zustand
- **Пути импорта:** `@/*` → `src/*`, `@db/*` → `DB/*`

## Команды

| Команда | Действие |
| :--- | :--- |
| `npm run dev` | Dev-сервер Next.js |
| `npm run build` | Прод-сборка (проверка типов перед сдачей) |
| `npm run lint` | ESLint |
| `npm run cron` | Cron-worker (`src/cron-worker.ts`, `node-cron` в dev) |

## Структура проекта

### `src/`
- `src/pages/` — Pages Router.
  - `src/pages/api/` — **API-роуты** по доменам: `auth/`, `admin/`, `users/`, `marathons/`, `streams/`, `reports/`, `rating/`, `products/`, `recipes/`, `workouts/`, `help/`, `messages/`, `uploads/`, `health/`.
  - `src/pages/dashboard/`, `mentor/`, `admin/`, `streams/`, `recipes/`, `workouts/`, `help/`, `onboarding.tsx`, `register.tsx`, `login.tsx` — страницы клиента.
- `src/components/` — UI по модулям: `layout/` (`Header`, `Layout`), `day/` (в т.ч. `DayReport`, `ProductSearch`, `ReportTable`, `PulseReadingsForm`), `marathon/`, `mentor/`, `recipes/`, `workouts/`, `help/`, `Chat/` + общие `attachments/`, `editor/`, `stream/`.
- `src/lib/` — ключевые утилиты: `apiHandler.ts`, `middleware.ts`, `auth.ts`, `db.ts`, `api.ts`, `apiClient.ts`, `cookies.ts`, `ratingCalculator.ts`, `calorieCalculator.ts`, `calendar.ts`, `validate.ts` (+ `validation.ts` — реэкспорт), `recipeUtils.ts`, `workoutUtils.ts`, `contentAttachmentUtils.ts`, `attachmentEditor.ts`, `attachmentUtils.ts`, `attachmentGroups.ts`, `fileUpload.ts`, `audioUpload.ts`, `helpUtils.ts`, `helpSlug.ts`, `sanitize.ts`, `errors.ts`, `cron.ts`, `kinescope.ts`.
- `src/services/` — `authService.ts`, `messageService.ts`.
- `src/stores/` — zustand-сторы: `authStore.ts`, `participantDayStore.ts`.
- `src/middleware/`, `src/hooks/`, `src/styles/`, `src/types/`.

### `DB/`
- `DB/models/` — Sequelize-модели (`User`, `MarathonTemplate`, `TemplateDay`, `Stream`, `StreamEnrollment`, `DailyReport`, `ReportLine`, `PulseReading`, `Product`, `Conversation`, `ConversationMember`, `Message`, `Recipe`, `RecipeFavorite`, `ContentAttachment`, `Workout`, `WorkoutFavorite`, `HelpArticle`, `StreamRating`, `TemplateAttachment`, `index.ts`).
- `DB/migrations/`, `DB/seeders/`, `DB/config/config.js` — конфиг Sequelize (см. `.sequelizerc`).

### `DOC/` — документация проекта
- `architecture.md` — архитектура (читать при входе в курс).
- `entities-and-relations.md` — сущности и связи БД.
- `implementation-plan.md` — дорожная карта, шаги отмечаются `[v]` (показывают, что реализовано).
- `product-vision.md`, `screens-and-ui.md`, `user-flows.md`, `rating-and-formulas.md`.
- `*/plan.md` (напр. `css-refactor-plan.md`, `participant-day-refactor-plan.md`, `report-extension-plan.md`), `admin-workflow.md`, `decisions-log.md`, `task-*.md` — планы и ТЗ по задачам.

## Документация, которую следует прочитать в начале работы

1. `DOC/architecture.md`
2. `DOC/entities-and-relations.md`
3. `DOC/implementation-plan.md` (оценить прогресс по `[v]`)

## Паттерны кодирования (следовать им обязательно)

- **API-роут:** `import { apiHandler, success } from '@/lib/apiHandler'` + стек middleware: `withAuth` → `withRole('role')` → обработчик. Для публичных роутов, где авторизация опциональна, — `withOptionalAuth`.
- **Ответ API:** `{ success: true, data: ... }` / `{ success: false, error: "..." }`.
- **Ошибки:** бросать `NotFound`, `Forbidden`, `BadRequest` и т.п. (см. `src/lib/errors.ts`).
- **Модели БД:** в `DB/models/`, импорт через `@db/models`.
- **Клиентские страницы:** `useEffect` + `fetch` + `useState`; роль через `getCookie('mp_role')`; API через `@/lib/apiClient`.
- **Стили:** CSS Modules (`*.module.css`) + глобальные переменные.

## Директории-исключения (не читать, не менять)

- `node_modules/`, `.next/`, `.git/`
- `*.tsbuildinfo`

## Прочее

- Локальный cron использует `node-cron` (`npm run cron`); в проде схема может отличаться.
- Переменные окружения — см. `.env.example` (ключи: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `NEXT_PUBLIC_APP_URL`).
