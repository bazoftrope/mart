# Сущности и связи

Справочник актуален по состоянию на **11.09.2026** и описывает 19 моделей из `DB/models/` (Sequelize-TS, декораторы, поэтому поля ниже приведены в camelCase — в БД через `underscored: true` они хранятся в snake_case).

Общие соглашения:
- Первичный ключ всех таблиц — `id` UUID (default `DataTypes.UUIDV4`).
- `underscored: true` → колонки из camelCase маппятся в snake_case (напр. `dayNumber` → `day_number`).
- timestamps задаются по ситуации (см. каждую модель).

---

## 1. User (Пользователь) — `users`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| email | string | unique, not null | Для входа, хранится в lowercase |
| passwordHash | string | not null | `password_hash`, хеш bcrypt |
| role | enum | not null | `mentor` / `participant` / `admin` |
| name | string | not null | Имя |
| timezone | string | not null, default `Europe/Moscow` | IANA-таймзона |
| sex | enum | nullable | `male` / `female` |
| heightCm | integer | nullable | Рост, см |
| weightKg | decimal(5,1) | nullable | Вес, кг |
| age | integer | nullable | Возраст, лет |
| createdAt | datetime | | `created_at` |
| updatedAt | datetime | | `updated_at` |

**Ограничения:**
- Один пользователь = одна роль (admin не создаётся через регистрацию, см. `ensureAdminUser` в `src/lib/auth.ts`).
- Поля профиля (`sex`, `heightCm`, `weightKg`, `age`) заполняются на онбординге (`src/pages/onboarding.tsx`) и используются для расчёта калорий.

---

## 2. Product (Продукт) — `products`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| name | string | unique, not null | Название |
| calories | decimal(8,2) | not null | `calories_per_100g` в старом названии; фактически колонка `calories` |
| createdAt | datetime | | `created_at`, `updatedAt` отключён |

**Ограничения:**
- Глобальная база, читается админом/сидером. Поиск по `name` (ILIKE) — `GET /api/products?search=`.
- В MVP участник не добавляет продукты.

---

## 3. MarathonTemplate (Шаблон марафона) — `marathon_templates`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| mentorId | UUID | not null | `mentor_id` → User.id (роль mentor) |
| title | string | not null | Название |
| description | text | nullable | Описание |
| durationDays | integer | not null | `duration_days` |
| introText | text | nullable | `intro_text` — текст предстартовой страницы (HTML от Quill) |
| status | enum | not null, default `draft` | `draft` / `pending_review` / `approved` |
| createdAt | datetime | | |
| updatedAt | datetime | | |

**Переходы статусов:**
```
draft → pending_review  (ментор отправляет, POST /api/marathons/:id/submit)
pending_review → approved (админ одобряет, POST /api/admin/:id/approve)
```
- Одобренные шаблоны можно запускать в потоки (`POST /api/streams`).
- Одобренный шаблон может редактировать ментор-владелец **без повторной проверки**;
  изменения сразу видны во всех потоках (без снимков материалов).

---

## 4. TemplateDay (День шаблона) — `template_days`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| templateId | UUID | not null | `template_id` → MarathonTemplate.id |
| dayNumber | integer | not null | `day_number`, 1..N |
| textContent | text | nullable | `text_content` — HTML от Quill (всегда) |
| isMeasurementDay | boolean | not null, default false | `is_measurement_day` — день замера веса и охватов |
| isTrainingDay | boolean | not null, default false | `is_training_day` — запланирована тренировка |
| isRestDay | boolean | not null, default false | `is_rest_day` — день отдыха/восстановления |
| isHealthyEatingDay | boolean | not null, default false | `is_healthy_eating_day` — день здорового питания |

**Ограничения:**
- Материалы дня (аудио, видео, PDF) хранятся не в этой таблице, а в `template_attachments` со `scope = 'day'`.
- Вложений может быть несколько на день.
- У дня могут одновременно быть `textContent` (HTML) и PDF-вложения (`kind = 'file'`); текст и PDF независимы.

---

## 4.1 TemplateAttachment (Вложение шаблона) — `template_attachments`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| templateId | UUID | not null | `template_id` → MarathonTemplate.id |
| templateDayId | UUID | nullable | `template_day_id` → TemplateDay.id; NULL = предстартовое вложение |
| scope | enum | not null | `intro` / `day` |
| kind | enum | not null | `audio` / `video` / `file` / `image` |
| url | string | not null | Путь `/api/uploads/audio/...`, `/api/uploads/file/...`, `/api/uploads/image/...` или `videoId` Kinescope |
| fileName | string | nullable | Исходное имя файла |
| mimeType | string | nullable | MIME |
| sizeBytes | integer | nullable | Размер |
| position | integer | not null, default 0 | Порядок вывода |
| pairId | UUID | nullable | `pair_id` — общий идентификатор комплекта «PDF + аудио»; у двух строк пары одинаковый |
| description | text | nullable | Описание аудио/видео (до 5000 символов) |
| createdAt | datetime | | `created_at` |

**Ограничения:**
- `templateDayId = NULL` + `scope = 'intro'` — материалы предстартовой страницы шаблона (общие для всех потоков).
- Аудио/видео/PDF у дня — строки со `scope = 'day'`.
- Комплект «PDF + аудио» — две строки одного дня (`scope = 'day'`) с одинаковым `pairId`: одна с `kind = 'file'` (PDF), вторая с `kind = 'audio'`. У одиночных вложений `pairId = NULL`.
- При сохранении дней шаблона вложения пересоздаются вместе с днями (текущее поведение `POST /days`).

---

## 5. Stream (Поток) — `streams`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| templateId | UUID | not null | `template_id` → MarathonTemplate.id |
| startDate | date | not null | `start_date`, DATEONLY |
| status | enum | not null, default `open` | `open` / `running` / `finished` |
| createdAt | datetime | | |
| updatedAt | datetime | | |

**Статусы:** `open` (набор до start_date), `running` (марафон идёт), `finished` (все дни пройдены). Точный день вычисляется по таймзоне пользователя (`src/lib/calendar.ts`).

---

## 6. StreamEnrollment (Запись на поток) — `stream_enrollments`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| streamId | UUID | not null | `stream_id` → Stream.id |
| participantId | UUID | not null | `participant_id` → User.id |
| goal | enum | not null, default `maintain` | `lose` / `maintain` / `gain` |
| targetCalories | integer | nullable | `target_calories`, рассчитанный при записи |
| enrolledAt | datetime | | `enrolled_at`, маппится из createdAt |
| updatedAt | datetime | | |

**Ограничения:**
- Запись только до старта потока; уникальность `stream_id + participant_id`.
- При записи (`POST /api/streams/:id/enroll`) вычисляется `targetCalories` по формулам `src/lib/calorieCalculator.ts`.

---

## 7. DailyReport (Отчёт за день) — `daily_reports`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| enrollmentId | UUID | not null | `enrollment_id` → StreamEnrollment.id |
| dayNumber | integer | not null | `day_number` |
| totalCalories | decimal(10,2) | not null, default 0 | Сумма строк отчёта |
| waterLiters | integer | nullable | Вода, л |
| steps | integer | nullable | Шаги |
| sleepHours | integer | nullable | Сон, ч |
| activityMinutes | integer | nullable | Активность, мин (зарезервировано) |
| trainingDone | boolean | nullable | `training_done` — тренировка была ✓/✗ |
| weightKg | integer | nullable | Вес, кг (наблюдение за день) |
| chestCm | decimal(10,2) | nullable | ОГ, см |
| waistCm | decimal(10,2) | nullable | ОТ, см |
| hipCm | decimal(10,2) | nullable | ОБ, см |
| legCm | decimal(10,2) | nullable | ОН, см |
| filledAt | datetime | | `filled_at`, из createdAt |
| updatedAt | datetime | | |

**Замечания:**
- Поля обхватов (ОГ/ОТ/ОБ/ОН) добавлены миграцией `20240815000001-add-body-measurements-to-daily-reports.js`.
- Уникальность `enrollment_id + day_number`.
- `totalCalories` считается автоматически из `ReportLine.line_calories`.

---

## 8. ReportLine (Строка отчёта) — `report_lines`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| reportId | UUID | not null | `report_id` → DailyReport.id |
| productId | UUID | not null | `product_id` → Product.id |
| weightGrams | decimal(8,2) | not null | `weight_grams` |
| lineCalories | decimal(10,2) | not null | `line_calories` |

**Расчёт** (`computeLineCalories` в `src/components/day/ReportTable.tsx`):
```
lineCalories = round(weightGrams × Product.calories / 100)
DailyReport.totalCalories = SUM(ReportLine.lineCalories)
```

---

## 9. StreamRating (Рейтинг потока) — `stream_ratings`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| streamId | UUID | not null | `stream_id` → Stream.id |
| participantId | UUID | not null | `participant_id` → User.id |
| filledDays | integer | not null, default 0 | `filled_days` |
| disciplinePercent | decimal(5,2) | not null, default 0 | `discipline_percent` — оставлено для совместимости |
| entryWeight | decimal(10,2) | nullable | `entry_weight`, первый вес в отчётах |
| currentWeight | decimal(10,2) | nullable | `current_weight`, последний вес |
| weightLossPercent | decimal(5,2) | not null, default 0 | `weight_loss_percent` — процент потери веса |
| rank | integer | nullable | Место в рейтинге |
| calculatedAt | datetime | not null, default NOW | `calculated_at` |

**Расчёт:** в `src/lib/ratingCalculator.ts` — сортировка по убыванию `weightLossPercent`, rank = индекс + 1. Поля веса добавлены миграцией `20240816000001-add-weight-fields-to-stream-ratings.js`.

**Обновление:** cron `npm run cron` (ежедневно 00:05, `src/lib/cron.ts`) + ручной `POST /api/rating/calculate` (admin).

---

## 10. PulseReading (Замер пульса) — `pulse_readings`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| reportId | UUID | not null | `report_id` → DailyReport.id |
| measuredAt | datetime | not null | `measured_at`, момент замера |
| pulse | integer | not null | Пульс, уд/мин |
| systolic | smallint | nullable | Систолическое давление, мм рт. ст. |
| diastolic | smallint | nullable | Диастолическое давление, мм рт. ст. |

**Замечание:** замеры привязаны к отчёту дня. Время измерения строится как дата дня отчёта (`startDate + dayNumber - 1`) + локальное время в таймзоне участника (`buildMeasuredAtUtc` в `src/lib/calendar.ts`).

---

## 11. Conversation (Беседа) — `conversations`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| type | enum | not null | `mentor_pair` / `group` |
| streamId | UUID | nullable | `stream_id` → Stream.id |
| createdAt | datetime | | |
| updatedAt | datetime | | |

**Типы:** `mentor_pair` — ментор↔участник (создаётся по запросу), `group` — ментор + все участники потока. Логика создания в `src/services/messageService.ts`.

---

## 12. ConversationMember (Участник беседы) — `conversation_members`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| conversationId | UUID | not null | `conversation_id` → Conversation.id |
| userId | UUID | not null | `user_id` → User.id |
| role | enum | not null | `participant` / `mentor` |
| lastReadAt | datetime | nullable | `last_read_at` |
| unreadCount | integer | not null, default 0 | `unread_count` |
| createdAt | datetime | | |
| updatedAt | datetime | | |

---

## 13. Message (Сообщение) — `messages`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| conversationId | UUID | not null | `conversation_id` → Conversation.id |
| senderId | UUID | not null | `sender_id` → User.id |
| text | text | not null | Текст |
| createdAt | datetime | | |

---

## 14. Recipe (Рецепт) — `recipes`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| title | string | not null | Название |
| description | text | nullable | Короткое описание |
| ingredients | text | not null | Ингредиенты, по одному на строку |
| steps | text | not null | Шаги приготовления, по одному на строку |
| createdBy | UUID | nullable | `created_by` → User.id; служебный автор |
| createdAt | datetime | | |
| updatedAt | datetime | | |

**Ограничения и особенности:**
- Общая книга рецептов: **нет привязки** к марафонам, потокам, дням или событиям.
- Смотреть, искать и открывать карточку может любой посетитель, в том числе гость.
- Добавлять рецепт может любой авторизованный пользователь (любая роль).
- `createdBy` нигде в интерфейсе не отображается и нужен только для прав: редактировать/удалять может автор или админ (`ON DELETE SET NULL`).
- Изображения (галерея) и PDF — в `content_attachments` с `owner_type = 'recipe'` (см. §17.1).
- Индексы: `created_at` (сортировка списка), `title`.

---

## 15. RecipeFavorite (Избранный рецепт) — `recipe_favorites`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| recipeId | UUID | not null | `recipe_id` → Recipe.id |
| userId | UUID | not null | `user_id` → User.id |
| createdAt | datetime | | |

**Ограничения:**
- Уникальность `recipe_id + user_id` — один рецепт в избранном один раз.
- `ON DELETE CASCADE` при удалении рецепта или пользователя.
- Избранное доступно только авторизованным пользователям (у гостей — приглашение войти).

---

## 16. Workout (Тренировка) — `workouts`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| title | string | not null | Название |
| description | text | nullable | Короткое описание |
| exercises | text | not null | Упражнения, по одному на строку |
| execution | text | not null | Порядок выполнения, по одному шагу на строку |
| createdBy | UUID | nullable | `created_by` → User.id; служебный автор |
| createdAt | datetime | | |
| updatedAt | datetime | | |

**Ограничения и особенности:**
- Общая книга тренировок: **нет привязки** к марафонам, потокам, дням или событиям.
- Смотреть, искать и открывать карточку может любой посетитель, в том числе гость.
- Добавлять тренировку может любой авторизованный пользователь (любая роль).
- `createdBy` нигде в интерфейсе не отображается и нужен только для прав: редактировать/удалять может автор или админ (`ON DELETE SET NULL`).
- Изображения (галерея) и PDF — в `content_attachments` с `owner_type = 'workout'` (см. §17.1).
- Индексы: `created_at` (сортировка списка), `title`.
- Полное зеркало сущности Recipe (см. §14), отличается названиями содержательных блоков.

---

## 17. WorkoutFavorite (Избранная тренировка) — `workout_favorites`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| workoutId | UUID | not null | `workout_id` → Workout.id |
| userId | UUID | not null | `user_id` → User.id |
| createdAt | datetime | | |

**Ограничения:**
- Уникальность `workout_id + user_id` — одна тренировка в избранном один раз.
- `ON DELETE CASCADE` при удалении тренировки или пользователя.
- Избранное доступно только авторизованным пользователям (у гостей — приглашение войти).

---

## 17.1 ContentAttachment (Вложение контента) — `content_attachments`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| ownerType | enum | not null | `recipe` / `workout` |
| ownerId | UUID | not null | `owner_id` — id рецепта или тренировки (без FK, удаляется вручную в API) |
| kind | enum | not null | `file` (PDF) / `image` / `audio` / `video` |
| url | string | not null | `/api/uploads/file/content/...` или `/api/uploads/image/content/...` |
| fileName | string | nullable | Исходное имя файла |
| mimeType | string | nullable | MIME |
| sizeBytes | integer | nullable | Размер |
| position | integer | not null, default 0 | Порядок вывода |
| pairId | UUID | nullable | `pair_id`, зарезервировано |
| description | text | nullable | Описание (до 5000 символов) |
| createdAt | datetime | | `created_at` |

**Ограничения:**
- Общие вложения для книг рецептов и тренировок: изображения (галерея), PDF и видео по ссылке Kinescope.
- Изображения и PDF загружаются файлом: `POST /api/uploads/image` (без `templateId`) и `POST /api/uploads/content/file`. Видео не загружается файлом — в `url` хранится нормализованный id Kinescope (валидация в `contentAttachmentSchema`).
- Файлы хранятся в `<UPLOAD_DIR>/content/`, отдаются через `/api/uploads/image/[...path]` и `/api/uploads/file/[...path]`.
- При сохранении рецепта/тренировки (`POST`/`PUT`) вложения пересоздаются; при удалении владельца — удаляются.

---

## 18. HelpArticle (Статья помощи) — `help_articles`

| Поле | Тип | Ограничение | Описание |
|------|-----|-------------|----------|
| id | UUID | PK | |
| slug | string | not null, unique | Адрес статьи в разделе: `/help/<slug>` |
| title | string | not null | Заголовок |
| summary | text | null | Краткое описание для карточки и поиска |
| content | text | not null | HTML из Quill, санируется на сервере |
| section | enum | not null | `rules` / `faq` / `guide` |
| audience | enum | not null | `all` / `participant` / `mentor` / `admin` |
| position | integer | not null | Порядок вывода внутри раздела |
| isPublished | boolean | not null | Черновик / опубликовано |
| createdBy | UUID | null | `created_by` → User.id, `SET NULL`; в UI не показывается |
| createdAt | datetime | | |
| updatedAt | datetime | | |

**Ограничения:**
- `slug` уникален; правила формирования — `src/lib/helpSlug.ts`.
- Чтение публичное: гости видят только `isPublished = true` и `audience = all`; участники и менторы — плюс статьи своей роли, админ — все.
- Создание/изменение/удаление — только админ (в интерфейсе — `/admin/help`).
- `ON DELETE SET NULL` при удалении пользователя-автора.
- Контент хранится как санированный HTML (см. `src/lib/sanitize.ts`).

---

## Диаграмма связей (текстовая)

```
User (1) ───< (N) MarathonTemplate
                └──< (N) TemplateDay

MarathonTemplate (1) ───< (N) Stream
                              └──< (N) StreamEnrollment
                                        ├──< (N) DailyReport
                                        │        ├──< (N) ReportLine
                                        │        │        └── (N) Product
                                        │        └──< (N) PulseReading
                                        └──< (N) StreamRating

Stream (1) ───< (N) StreamRating
Stream (1) ───< (N) Conversation  ──< (N) ConversationMember (N) User
                                        └──< (N) Message

User (1) ───< (N) RecipeFavorite (N) ─── (1) Recipe
User (1) ───< (N) WorkoutFavorite (N) ─── (1) Workout
Recipe (1) ───< (N) ContentAttachment
Workout (1) ───< (N) ContentAttachment

User (0..1) ───< (N) HelpArticle
```

## Индексы и уникальность

| Таблица | Уникальность / индекс | Причина |
|---------|----------------------|---------|
| User | email unique | Вход |
| Product | name unique | Поиск |
| MarathonTemplate | mentor_id | Фильтр ментором |
| TemplateDay | template_id, day_number | День в шаблоне |
| Stream | template_id | Фильтр потоков |
| StreamEnrollment | stream_id, participant_id | Одна запись на поток |
| DailyReport | enrollment_id, day_number | Один отчёт на день |
| ConversationMember | conversation_id, user_id | Принадлежность к беседе |
| Recipe | created_at, title | Сортировка и поиск по книге рецептов |
| RecipeFavorite | recipe_id, user_id unique | Один рецепт в избранном один раз |
| Workout | created_at, title | Сортировка и поиск по книге тренировок |
| WorkoutFavorite | workout_id, user_id unique | Одна тренировка в избранном один раз |
| ContentAttachment | owner_type+owner_id+position; owner_id; pair_id | Вложения рецепта/тренировки |
| HelpArticle | slug unique; section+audience; is_published+position | Адрес статьи и выборка раздела |

> Примечание: фактический список индексов лучше сверять с миграциями в `DB/migrations/` — в коде моделей (Sequelize-TS) индексы описываются не всегда, часть задана прямо в миграциях.
