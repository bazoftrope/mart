# Архитектура и стек технологий

Актуально по состоянию на **11.09.2026**.

## Общие принципы

- **Минимум зависимостей** — каждая библиотека должна оправдывать своё существование.
- **Один репозиторий** — фронтенд и API в одном проекте Next.js.
- **TypeScript везде** — strict-режим, типизация от моделей до компонентов.
- **PostgreSQL как источник правды** — все данные в одной базе.
- **Pages Router** — Next.js Pages Router (НЕ App Router).

## Стек технологий

| Слой | Технология | Версия | Почему |
|------|-----------|--------|--------|
| Фреймворк | Next.js (Pages Router) | 14.2 | API Routes, SSR |
| Язык | TypeScript | 5.x | strict |
| ORM | Sequelize + sequelize-typescript | 6.x | Декораторы для моделей |
| База данных | PostgreSQL | 15+ | Надёжность, агрегации |
| Аутентификация | JWT (jsonwebtoken 9.x) в куках | | `mp_access_token`, `mp_refresh_token` |
| Валидация | Zod | 4.x | Схемы API и форм |
| UI | CSS Modules + глобальные переменные | — | `src/styles/globals.css`, без Tailwind |
| Иконки | Lucide React | 1.x | tree-shakeable |
| Графики | Recharts | 3.x | Страницы результатов |
| Состояние | zustand | 5.x | `authStore`, `participantDayStore` |
| Cron | node-cron (dev) | 3.x | `npm run cron` |

**Пути импорта** (tsconfig):
- `@/*` → `src/*`
- `@db/*` → `DB/*` (напр. `@db/models`, `@db/models/User`, `@db/db`)

## Структура проекта

```
marathon-platform/
├── DB/
│   ├── db.ts                    # Подключение Sequelize (из DATABASE_URL или DB_* env)
│   ├── config/config.js         # Конфиг Sequelize CLI (dev/test/prod)
│   ├── models/                  # 20 моделей (index.ts экспортирует все + `models` map + `AppModels`)
│   ├── migrations/              # Sequelize CLI миграции (21 файл)
│   └── seeders/                 # Seed-данные (продукты, демо-рецепты, демо-тренировки, статьи помощи, dev-аккаунты Ирина/Вова)
├── src/
│   ├── pages/                   # Pages Router
│   │   ├── _app.tsx             # Layout + globals.css
│   │   ├── index.tsx            # Главная — список потоков (open)
│   │   ├── login.tsx, register.tsx, onboarding.tsx
│   │   ├── api/                 # API Routes (весь бэкенд)
│   │   ├── dashboard/           # ЛК участника
│   │   ├── mentor/              # ЛК ментора
│   │   ├── admin/               # Админ-панель
│   │   ├── recipes/             # Публичная книга рецептов
│   │   ├── workouts/            # Публичная книга тренировок
│   │   ├── help/                # Публичный раздел «Правила и помощь»
│   │   └── streams/[id]/        # Публичная страница потока
│   ├── components/              # UI-компоненты
│   ├── lib/                     # Утилиты и серверная логика
│   ├── services/                # Серверные сервисы
│   ├── stores/                  # zustand-сторы
│   ├── styles/globals.css       # Глобальные стили + переменные
│   ├── types/                   # TS-интерфейсы (@/types)
│   ├── middleware/              # (зарезервировано)
│   └── cron-worker.ts           # Точка входа cron (tsx)
├── .env.example                 # Шаблон env
└── next.config.mjs              # (ESM), реакт strict mode
```

## API Routes — полный список (`src/pages/api/`)

**auth/**
- `POST /api/auth/register` — регистрация (участник/ментор)
- `POST /api/auth/login` — вход (incl. admin по `ADMIN_EMAIL`)
- `POST /api/auth/logout` — выход, чистка кук
- `POST /api/auth/refresh` — обновление access-токена

**users/**
- `GET /api/users/me` — текущий юзер + `profileCompleted`
- `PATCH /api/users/me` — заполнение профиля (онбординг); требует согласие на данные о здоровье
- `DELETE /api/users/me` — удаление аккаунта и данных (участник/ментор; пароль + слово «удалить»)
- `GET /api/users/me/deletion-impact` — что будет затронуто при удалении (шаблоны, потоки, участники)
- `GET /api/users/me/export` — экспорт данных пользователя файлом JSON (152-ФЗ)
- `GET /api/users/me/consents` — согласия пользователя + версии текстов (152-ФЗ)
- `POST /api/users/me/consents` — зафиксировать согласие (`type`: `general` / `health`)
- `DELETE /api/users/me/consents/[type]` — отозвать согласие (`revokedAt`)

**marathons/**
- `GET/POST /api/marathons` — шаблоны ментора (список/создание)
- `GET/PUT/DELETE /api/marathons/[id]` — шаблон по ID
- `POST /api/marathons/[id]/submit` — отправить на проверку
- `GET/POST /api/marathons/[id]/days` — дни шаблона (bulk-обновление)

**admin/**
- `GET /api/admin/pending` — марафоны на проверке
- `POST /api/admin/[id]/approve` — одобрить марафон
- `GET /api/admin/users` — список юзеров (filter `?role=`)
- `GET/PUT /api/admin/users/[id]` — просмотр/смена роли

**streams/**
- `GET /api/streams` — публичный список (open)
- `POST /api/streams` — запустить поток из approved-шаблона (ментор)
- `GET /api/streams/my` — мои потоки (ментор/участник)
- `GET /api/streams/[id]` — публичная страница потока (+ isEnrolled)
- `POST /api/streams/[id]/enroll` — записаться (участник; считает targetCalories)
- `GET /api/streams/[id]/calendar` — календарь дней (участник)
- `GET /api/streams/[id]/days` — bulk-данные всех дней (участник)
- `POST /api/streams/[id]/day/[dayNumber]` — создать отчёт за день
- `GET /api/streams/[id]/rating` — рейтинг (участник)
- `GET /api/streams/[id]/results` — результаты (участник)
- `GET /api/streams/[id]/enrollments` — участники потока (ментор)
- `GET /api/streams/[id]/participants/[participantId]` — детали участника (ментор)

**reports/**
- `PUT /api/reports/[reportId]` — редактировать отчёт (участник)

**products/** — общий каталог продуктов и блюд
- `GET /api/products?search=` — поиск продуктов (autocomplete, max 20; отдаёт ккал и Б/Ж/У на 100 г)
- `POST /api/products` — добавить продукт (любая авторизованная роль): название, ккал, Б/Ж/У; при совпадении имени возвращается существующий

**admin/products/** — управление каталогом (админ)
- `GET /api/admin/products?search=&page=&limit=` — список с поиском и пагинацией
- `POST /api/admin/products` — создать продукт
- `GET/PUT/DELETE /api/admin/products/[id]` — продукт: чтение/правка/удаление. Удаление продукта, используемого в `report_lines`, запрещено (409)

**recipes/** — общая книга рецептов (публичное чтение)
- `GET /api/recipes?search=&favorites=&page=&limit=` — список рецептов (поиск по названию/описанию/ингредиентам/шагам, пагинация; для авторизованных — `isFavorite`, `canEdit`; `favorites=1` требует входа)
- `POST /api/recipes` — добавить рецепт (любая авторизованная роль)
- `GET /api/recipes/[id]` — карточка рецепта (публично)
- `PUT /api/recipes/[id]` — изменить (автор или админ)
- `DELETE /api/recipes/[id]` — удалить (автор или админ)
- `POST /api/recipes/[id]/favorite` — добавить в избранное (авторизованный)
- `DELETE /api/recipes/[id]/favorite` — убрать из избранного (авторизованный)

**workouts/** — общая книга тренировок (публичное чтение, зеркало книги рецептов)
- `GET /api/workouts?search=&favorites=&page=&limit=` — список тренировок (поиск по названию/описанию/упражнениям/выполнению, пагинация; для авторизованных — `isFavorite`, `canEdit`; `favorites=1` требует входа)
- `POST /api/workouts` — добавить тренировку (любая авторизованная роль)
- `GET /api/workouts/[id]` — карточка тренировки (публично)
- `PUT /api/workouts/[id]` — изменить (автор или админ)
- `DELETE /api/workouts/[id]` — удалить (автор или админ)
- `POST /api/workouts/[id]/favorite` — добавить в избранное (авторизованный)
- `DELETE /api/workouts/[id]/favorite` — убрать из избранного (авторизованный)

**help/** — раздел «Правила и помощь» (публичное чтение, запись — админ)
- `GET /api/help?search=&section=&audience=` — список статей. Гость видит только `isPublished` + `audience=all`; участник/ментор — плюс статьи своей роли; админ — все. Для админа `?all=1` — черновики и все аудитории (используется в `/admin/help`)
- `POST /api/help` — создать статью (админ)
- `GET /api/help/[slug]` — статья по slug (публично; черновик видит только админ)
- `PUT /api/help/[slug]` — изменить, включая смену slug (админ)
- `DELETE /api/help/[slug]` — удалить (админ)

**messages/**
- `GET/POST /api/messages` — список бесед / создать беседу
- `GET/POST /api/messages/[id]` — сообщения беседы / отправить сообщение

**uploads/**
- `POST /api/uploads/audio` — загрузка аудиофайлов (ментор)
- `POST /api/uploads/file` — загрузка PDF для шаблона (ментор)
- `POST /api/uploads/image` — загрузка изображений: для шаблона (с `templateId`, ментор) и для контента рецептов/тренировок (без `templateId`, любая роль)
- `POST /api/uploads/content/file` — загрузка PDF для контента рецептов/тренировок (любая роль)
- `GET /api/uploads/audio/[...path]`, `GET /api/uploads/file/[...path]`, `GET /api/uploads/image/[...path]` — отдача файлов (Range)

**rating/**
- `POST /api/rating/calculate` — ручной пересчёт рейтинга (admin)

**health/**
- `GET /api/health/db` — проверка подключения к БД

## Аутентификация и middleware

### Куки
| Cookie | HttpOnly | Срок | Назначение |
|--------|----------|------|------------|
| `mp_access_token` | да | 15 мин | Доступ к API |
| `mp_refresh_token` | да | 7 дней | Обновление access |
| `mp_role` | нет | 7 дней | Роль для фронта |
| `mp_user_id` | нет | 7 дней | ID пользователя для фронта |

(секции куков и middleware описаны в `src/lib/auth.ts` и `src/lib/middleware.ts`)

### Middleware (`src/lib/middleware.ts`)
- `withAuth(handler)` — проверка access-токена из куки, кладёт `req.user` (TokenPayload)
- `withOptionalAuth(handler)` — для публичных роутов: если токен валиден, кладёт `req.user`, иначе пускает как гостя (используется в книгах рецептов и тренировок)
- `withRole(role)(handler)` — проверка роли после `withAuth`
- готова: `withAdmin`, `withMentor`, `withParticipant`

### Схема API Request/Response
```typescript
// src/lib/apiHandler.ts
{ success: true, data: ... }        // ApiSuccessResponse
{ success: false, error, message }  // ApiErrorResponse
{ success: false, error: 'VALIDATION_ERROR', message, issues: {...} }  // Zod-ошибка
```
- `apiHandler(methods)` — единая обёртка: CORS, OPTIONS, 405, обработка `AppError`, `ZodError`, 500.
- `success(res, data, status=200)`, `error(res, status, code, message)`.
- Хелпер `@/lib/api.ts` реэкспортирует `apiHandler, success, error` и ошибки; `ApiError` помечен `@deprecated`.

### Ошибки (`src/lib/errors.ts`) — наследуют `AppError`
| Класс | HTTP | Код |
|-------|------|-----|
| `BadRequest` | 400 | `BAD_REQUEST` |
| `Unauthorized` | 401 | `UNAUTHORIZED` |
| `Forbidden` | 403 | `FORBIDDEN` |
| `NotFound` | 404 | `NOT_FOUND` |
| `Conflict` | 409 | `CONFLICT` |

### Канонический пример API-роута
```typescript
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withMentor } from '@/lib/middleware';
import { NotFound } from '@/lib/errors';
import type { AuthenticatedRequest } from '@/types/auth';

async function getHandler(req, res) {
  const { user } = req as AuthenticatedRequest;
  // ... логика
  return success(res, data);
}

export default apiHandler({ GET: withMentor(getHandler) });
```

## База данных

- Подключение `DB/db.ts` (`sequelize`), реэкспорт через `src/lib/db.ts` (`import '@/lib/db'` в роутах).
- Источник подключения: `DATABASE_URL` (URL) или `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD/DB_PORT` — см. `DB/db.ts` и `DB/config/config.js`.
- Модели регистрируются явным списком в `DB/db.ts` и `DB/models/index.ts`.

### Миграции
| Файл | Назначение |
|------|-----------|
| `20240724000001-create-users.js` | users |
| `20240724000002-create-products.js` | products (name, calories, Б/Ж/У, `created_at`/`updated_at`) |
| `20240724000003-create-marathon-templates.js` | marathon_templates |
| `20240724000004-create-template-days.js` | template_days |
| `20240724000005-create-streams.js` | streams |
| `20240724000006-create-stream-enrollments.js` | stream_enrollments |
| `20240724000007-create-daily-reports.js` | daily_reports |
| `20240724000008-create-report-lines.js` | report_lines (+ `meal_type`, `line_protein/fat/carbs`) |
| `20240724000009-create-stream-ratings.js` | stream_ratings |
| `20240724000010-create-pulse-readings.js` | pulse_readings |
| `20240815000001-add-body-measurements-to-daily-reports.js` | ОГ/ОТ/ОБ/ОН |
| `20240815000002-create-conversations.js` | conversations + members + messages |
| `20240816000001-add-weight-fields-to-stream-ratings.js` | вес в рейтинге |
| `20260831000001-add-video-id-to-template-days.js` | `video_id` Kinescope |
| `20260905000001-create-template-attachments.js` | вложения `template_attachments` (`pair_id`) + `intro_text` + книга рецептов (`recipes`, `recipe_favorites`) |
| `20260905000002-add-session1-missing-columns.js` | поля сессии 1 |
| `20260905000003-remove-text-editor.js` | удаление настройки редактора |
| `20260905000004-fix-attachment-filenames-encoding.js` | починка имён файлов (mojibake) |
| `20260910000002-create-workouts.js` | книга тренировок (`workouts`, `workout_favorites`) |
| `20260911000001-create-help-articles.js` | раздел «Правила и помощь» (`help_articles`) |
| `20260917000001-create-user-consents.js` | согласия на обработку ПДн (`user_consents`, 152-ФЗ) |

Команды: `npx sequelize-cli db:migrate` / `db:migrate:undo` / `db:seed:all` / `db:seed:undo:all` (`npm run db:reset` — drop+create+migrate+seed:all).

### Сидеры (`DB/seeders/`)

| Файл | Назначение |
|------|-----------|
| `20240724000001-products.js` | Базовый каталог продуктов |
| `20260913000001-products-catalog.js` | Расширенный каталог продуктов |
| `20260910000001-demo-recipes.js` | Демо-рецепты |
| `20260910000002-demo-workouts.js` | Демо-тренировки |
| `20260911*` + `20260914*` | Статьи «Правила и помощь» |
| `20260915000001-dev-personal-accounts.js` | **Личные dev-аккаунты Ирина/Вова (2 пары mentor+participant)** — `irina.mentor@test.ru`, `irina@test.ru`, `vova.mentor@test.ru`, `vova@test.ru` (пароль `12345678` для всех). Идемпотентный, `scripts/reset-db.cjs` вызывает `db:seed:all` автоматически. См. `DOC/local/info.md` (локальный файл, в git не хранится). |

> **Соглашение по миграциям (важно для агента).** Пока в базе нет прод-данных
> (и пользователей, которых нельзя потерять), новые файлы миграций **не создаём** —
> изменения схемы вносим правкой уже существующих файлов, чтобы не плодить файлы.
> Например, таблицы книги рецептов (`recipes`, `recipe_favorites`) добавлены прямо
> в `20260905000001-create-template-attachments.js`, а не отдельным файлом.
>
> Такой подход уместен **только пока данными можно пренебречь**: когда в базе появятся
> реальные данные/пользователи, изменения снова оформляем отдельными файлами миграций,
> чтобы их можно было безопасно накатывать на живую базу, не пересоздавая её.
>
> Если миграции уже были применены локально — откатить до нужной (`db:migrate:undo`)
> или пересоздать базу (`npm run db:reset`), а затем выполнить `db:migrate` заново.
>
> **Исключение — книга тренировок.** Её таблицы (`workouts`, `workout_favorites`)
> оформлены отдельным файлом `20260910000002-create-workouts.js`: к моменту
> добавления миграция `20260905000001` уже была применена локально и дописать
> в неё таблицы было нельзя без пересоздания базы. С этого момента новые
> изменения схемы — только отдельными файлами миграций.
>
> **Обновление (13.09.2026, Решение 24).** Для расширения калоризатора (БЖУ, приёмы
> пищи) снова правим уже существующие миграции (`20240724000002-create-products.js`,
> `20240724000008-create-report-lines.js`): данные в базе признаны расходными, база
> пересоздаётся через `npm run db:reset`. Правило «дальше только отдельными файлами»
> возвращается, как только в базе появятся реальные данные, которые нельзя потерять.

## Расчёт калорий (`src/lib/calorieCalculator.ts`)

Формула Миффлина-Сан Жеора с фиксированным коэффициентом активности **1.2**:
```
female: База = (6.25×Рост + 10×Вес − 5×Возраст − 161) × 1.2
male:   База = (6.25×Рост + 10×Вес − 5×Возраст + 5) × 1.2
```
Итог с учётом цели:
| Цель (`Goal`) | Множитель | Описание |
|-------------|-----------|----------|
| `lose` | 0.85 | дефицит 15% |
| `maintain` | 1.0 | без изменений |
| `gain` | 1.15 | профицит 15% |

`calculateTargetCalories` округляет до целого. Заполнение профиля проверяется через `isProfileComplete`.

## Расчёт БЖУ (`src/lib/nutritionCalculator.ts`)

- Продукты хранят Б/Ж/У на 100 г. Строка отчёта денормализует значения с учётом веса:
  `line_calories = вес × ккал/100`, `line_protein/fat/carbs = вес × макро/100` (округление до 2 знаков).
- Приёмы пищи — `MealType = breakfast | lunch | dinner | snack` (`report_lines.meal_type`).
- Пропорции БЖУ считаются по калориям: `Э = Б×4 + Ж×9 + У×4`, доля каждого макроса в `Э`.
  Возвращаются целые проценты, сумма которых ровно 100 (метод наибольших остатков);
  если макросов нет — `null`.
- Формы продуктов авто-подставляют ккал как `4×Б + 9×Ж + 4×У` (поле редактируемое).

## Расчёт рейтинга (`src/lib/ratingCalculator.ts`)

- `calculateRatingsForStream(streamId)` — для каждого участника считает `filledDays`, `entryWeight`/`currentWeight` (первый/последний вес в отчётах), `weightLossPercent = (entry − current)/entry × 100`.
- Сортировка по убыванию `weightLossPercent`, `rank = index + 1`. Всё в транзакции.
- `calculateAllRatings()` — по всем `running`/`finished` потокам.

### Запуск
- Cron: `npm run cron` → `src/cron-worker.ts` → `src/lib/cron.ts` (node-cron, ежедневно 00:05).
- Ручной: `POST /api/rating/calculate` (admin).

## Клиентская сторона

- **API-клиент:** `src/lib/apiClient.ts` — `apiClient.get/post/put/patch/delete<T>()` и `apiFetch()`; автоматический refresh access-токена при 401 (единственный refreshPromise), редирект на `/login` при неудаче.
- **Куки на клиенте:** `src/lib/cookies.ts` — `getCookie`/`deleteCookie`.
- **Авторизация:** `useAuthStore` (zustand) — `initAuth()` читает `mp_role`/`mp_user_id`; login/register/logout через `authService`.
- **Роль/ID на фронте:** через `getCookie('mp_role')` / `readUserId()`.
- **День участника:** `useParticipantDayStore` (zustand) — кэш дней `daysCache`, lines/metrics/pulseReadings, `saveReport`.

## Типы клиента (`src/types/`)

- `auth.ts` — `UserRole`, `TokenPayload`, `AuthenticatedRequest`, `PublicUser`.
- `participantDay.ts` — данные дня участника (`ParticipantDayData`, `DayReportData`, `MetricsState`, `PulseReadingItem`).
- `recipe.ts` — DTO книги рецептов (`Recipe`, `RecipeListResponse`).
- `workout.ts` — DTO книги тренировок (`Workout`, `WorkoutListResponse`).
- `help.ts` — DTO раздела «Правила и помощь» (`HelpArticle`, `HelpArticleListItem`, `HelpListResponse`, `HelpSection`, `HelpAudience`) + мапы подписей.
- `consent.ts` — DTO согласий (`UserConsentDto`, `ConsentsResponse`).
- `account.ts` — DTO последствий удаления аккаунта (`DeletionImpact`).
- `pg.d.ts` — декларация типов для `pg`.

## Cron в проде

Локально — `node-cron` (`npm run cron`). В проде схема может отличаться (внешний cron или отдельный процесс): при добавлении задач учитывать это.

## Key design & рефакторинги

- Структура дня участника вынесена в компоненты `src/components/day/*` (`DayHeader`, `DayMaterials`, `DayReport`, `DayTabs`, `KinescopePlayer`) и `src/components/marathon/*` (`MarathonWindow`, `DayView`, `DayNavbar`, `MarathonHeader`).
- Материалы шаблона/дня (ментор): один редактор на день — `src/components/mentor/AttachmentsEditor` (секции изображений, PDF, аудио, видео); правила комплектов «медиа + PDF» — чистые функции в `src/lib/attachmentEditor.ts` (строки идентифицируются ключом `id`/`clientKey`, `pairId` генерируется на клиенте).
- Чат: компоненты `src/components/Chat/MarathonChatPopup` (участник, всплывающий чат в шапке марафона) и `src/components/Chat/MentorStreamChat` (ментор, чат на странице потока). Общие типы — в `src/components/Chat/Chat.tsx`. Страницы `/dashboard/messages` и `/mentor/messages` — редиректы («чат переехал»). Для завершённых потоков чат закрыт (только чтение).
- Книга рецептов: общая, без привязки к марафонам. Модели `Recipe` (служебный `createdBy` в UI не показывается) и `RecipeFavorite`, вложения — `ContentAttachment` (`owner_type = 'recipe'`): изображения (галерея), PDF и видео по ссылке Kinescope. Публичный `GET /api/recipes` через `withOptionalAuth` дополняется `isFavorite`/`canEdit` и вложениями. UI: `src/pages/recipes/*`, компоненты `src/components/recipes/*`, редактор вложений `src/components/attachments/ContentAttachmentManager` (логика списка — общая `src/lib/attachmentEditor.ts`).
- Книга тренировок: полное зеркало книги рецептов (та же механика — публичное чтение, поиск, пагинация, избранное, права автор/админ, вложения `ContentAttachment` с `owner_type = 'workout'`: изображения, PDF, видео Kinescope). Модели `Workout` (`title`, `description`, `exercises`, `execution`, служебный `createdBy`) и `WorkoutFavorite`; UI: `src/pages/workouts/*`, компоненты `src/components/workouts/*`. Кнопка избранного переиспользуется из книги рецептов (`src/components/recipes/FavoriteButton`).
- Раздел «Правила и помощь»: модель `HelpArticle` (разделы `rules`/`faq`/`guide`, аудитории `all`/`participant`/`mentor`/`admin`, `slug`, черновики); публичное чтение через `withOptionalAuth`, запись — только `withAdmin`. UI: `src/pages/help/*` (список с поиском и табами, страница статьи), админка `src/pages/admin/help/*` (CRUD с Quill), компоненты `src/components/help/*`. Тексты санируются `sanitizeRichText` при сохранении; слаги формирует `src/lib/helpSlug.ts`, где лежат константы `HELP_SLUG_RULES`/`HELP_SLUG_REPORT_GUIDE` для контекстных ссылок (на странице дня, потоке и регистрации). Стартовый набор статей — сидер `20260911000001-demo-help-articles.js`. Подробнее (историческое ТЗ): `DOC/archive/help-center-plan.md`.
- Согласия на обработку ПДн (152-ФЗ): модель `UserConsent` (`general` / `health`), серверная логика — `src/lib/consentService.ts`, версии и адреса текстов — `src/lib/consent.ts`, публичная страница — `src/pages/privacy.tsx` (тексты-заглушки до проверки юристом). Согласие фиксируется на сервере при регистрации (`general`) и при сохранении анкеты (`health`, `PATCH /api/users/me`), хранится с версией текста, IP и User-Agent; отзыв проставляет `revokedAt`. Анкета доступна только с 18 лет. Подробнее: `DOC/legal-fz152.md`, Решение 31/32.
- Права субъекта ПДн: экспорт данных (`GET /api/users/me/export`) и удаление аккаунта (`DELETE /api/users/me`) — `src/lib/userDataService.ts`. Удаление доступно участнику и ментору; у ментора каскад затрагивает потоки и данные участников, поэтому `GET /api/users/me/deletion-impact` отдаёт числа для предупреждения. UI — `src/pages/account.tsx` + `src/components/account/AccountDataSection.tsx` (согласия, отзыв, экспорт, удаление); ссылка «Аккаунт» в шапке для всех ролей. Подробнее: Решение 33.
- Исторические планы рефакторингов: `DOC/archive/css-refactor-plan.md`, `DOC/archive/participant-day-refactor-plan.md`, `DOC/archive/report-extension-plan.md`.
