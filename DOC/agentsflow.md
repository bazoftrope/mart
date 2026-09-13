       mimeType: STRING(255) nullable (62-66)
       sizeBytes: INTEGER nullable (68-72)
       position: INTEGER not null default 0 (74-79)
       pairId: UUID nullable (81-85) // groups PDF+audio/video
       description: TEXT nullable (87-91) // video/audio description, 5000 limit via validation/slicing
       createdAt: DATE (93-94) via @CreatedAt

     1.4 Shared Types

     - src/types/attachments.ts:1-25 mirrors model: AttachmentData with id?, kind, url, fileName?, mimeType?, sizeBytes?, position?, pairId?, description? and AttachmentInput identical.
     - src/types/participantDay.ts:7-10 DayMaterialsData { textContent: string|null, attachments: AttachmentData[] }.

     2. DB Migration & Indexes

     2.1 Main migration DB/migrations/20260905000001-create-template-attachments.js (288 lines)

     - up:8-76 creates template_attachments table l.8-76, indexes:
       - l.78: ['template_id','scope','position']
       - l.79-81: ['template_day_id','pair_id'] named template_attachments_template_day_id_pair_id
       - Adds intro_text col to marathon_templates l.83-86
       - Data migration l.88-131: SELECT id,template_id,audio_url,video_id FROM template_days WHERE ... then bulkInsert 2 rows per day (position 0=audio, 1=video if both existed). Uses crypto.randomUUID()
         per row.
       - Removes old columns l.133-134.
     - down:225-287 reverse: restores audio_url(230-233) / video_id(234-237), re-populates first audio/video per day (239-276), drops intro_text (278), drops table (280), drops ENUM types (281-286).
     - Also in same file creates recipes/recipe_favorites (139-222) due to “не плодить файлы” comment l.136-138.

     2.2 Related migrations

     - 20260905000003-remove-text-editor.js (96 lines): removes deprecated marathon_templates.text_editor plain/html toggle; converts plain intro_text/text_content to HTML via plainTextToHtml l.22-30 (<p>
       + <br>).
     - 20260905000004-fix-attachment-filenames-encoding.js (52 lines): repairs mojibake Cyrillic filenames caused by earlier multipart latin1 bug (see audioUpload.ts:104-122). Detects via isLikelyMojibake
       l.3-24, decodes Buffer.from(file_name,'latin1').toString('utf8') l.40.
     - DB/migrations/20240724000004-create-template-days.js, 20260831000001-add-video-id-to-template-days.js historically added audio_url/video_id before attachment table.

     2.3 ORM registration

     - DB/db.ts:7,56 includes TemplateAttachment.
     - DB/models/index.ts:5,25,46 re-exports.

     3. Scope / Kind / pairId Logic

     ┌─────────────┬────────────────────┬────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────┐
     │Field        │Values              │Meaning                                                                                 │Key Logic Locations                                                       │
     ├─────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
     │scope        │intro vs day        │intro = предстартовые материалы шаблона (общие для всех потоков), day = контент         │Model TemplateAttachment:42 enum; DOC/entities-and-relations.md:99        │
     │             │                    │конкретного дня                                                                         │                                                                          │

  ┃
  ┃  Explore (1 of 3) 75.1K (7%)                                                                                                                                            Parent up  Prev left  Next right
  ┃
  ├───────────────────┼───────────────────────────────────────────────────┼──────────────────────────────┼───────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │extra enums        │—                                                  │—                             │section/audience/position/isPublished          │isMeasurementDay/isTrainingDay/isRestDay/      │
  │                   │                                                   │                              │                                               │isHealthyEatingDay                             │
  ├───────────────────┼───────────────────────────────────────────────────┼──────────────────────────────┼───────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │slug               │нет (lookup по id UUID)                            │нет                           │slug STRING NOT NULL unique lookup по slug     │нет                                            │
  ├───────────────────┼───────────────────────────────────────────────────┼──────────────────────────────┼───────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │attachments        │нет                                                │нет                           │нет                                            │TemplateAttachment[] structured                │
  └───────────────────┴───────────────────────────────────────────────────┴──────────────────────────────┴───────────────────────────────────────────────┴───────────────────────────────────────────────┘

  8.6 Storage Format Summary

  - Text vs HTML: Recipe/Workout — text (plain), Help/TemplateDay — html (sanitized).
  - Line-based vs Structured: Recipe/Workout — line-based (\n внутри одного TEXT колонка, split при рендере); TemplateDay attachments — structured (отдельная таблица с типизированными полями kind/url/
    fileName/mimeType/sizeBytes/position/pairId); Help — structured но через HTML (не line-based), с метаданными section/audience/position.
  - Storage location: Recipe/Workout/Help — собственные таблицы; TemplateDay attachments — внешняя template_attachments с FK template_id + template_day_id.

  8.7 Слаги и константы

  - src/lib/helpSlug.ts L6-7 HELP_SLUG_RULES, HELP_SLUG_REPORT_GUIDE используются для контекстных линков (например, страница дня ссылается на kak-zapolnyat-otchet).
  - Recipe/Workout используют UUID в URL (/recipes/:id, /workouts/:id); Help — slug (/help/:slug, /admin/help/:slug).

  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  9. Итого: файловая карта с линиями

  Модели: DB/models/Recipe.ts:12, Workout.ts:12, HelpArticle.ts:15, RecipeFavorite.ts:11, WorkoutFavorite.ts:11, TemplateDay.ts:11, TemplateAttachment.ts:14, index.ts:15-18 экспорт
  Миграции: DB/migrations/20260905000001-create-template-attachments.js:139 recipes, :186 recipe_favorites, :51 template_attachments; 20260910000002-create-workouts.js:11 workouts, :58
  workout_favorites; 20260911000001-create-help-articles.js:13 help_articles
  Сиды: DB/seeders/20260910000001-demo-recipes.js:5 RECIPES join \n, 20260910000002-demo-workouts.js:5 WORKOUTS, 20260911000001-demo-help-articles.js:5 ARTICLES HTML
  Валидация: src/lib/validate.ts:126 recipeSchema, :149 workoutSchema, :172 helpArticleSchema, :64 templateAttachmentSchema, :100 templateDaySchema
  Утилиты: src/lib/recipeUtils.ts:4 RecipeDto, :21 canManageRecipe, :29 toRecipeDto; workoutUtils.ts:4 аналогично; helpUtils.ts:6 sanitizeHelpContent, :10 toHelpListItem, :24 toHelpArticleDto; helpSlug.
  ts:6 HELP_SLUG_*, :50 slugifyHelpTitle; sanitize.ts:9 sanitizeRichText; attachmentUtils.ts:5 serializeAttachment, :26 sanitizeTemplateText; middleware.ts:22 withAuth, :47 withOptionalAuth, :64
  withRole/withAdmin
  Типы: src/types/recipe.ts:1 Recipe, workout.ts:1 Workout, help.ts:5 HelpArticleListItem, :17 HelpArticle, attachments.ts:4 AttachmentData
  API: src/pages/api/recipes/index.ts:33 getHandler public ILIKE 4 fields, :96 postHandler; [id].ts:15 loadRecipe, :23 isFavoriteFor, :32 GET, :46 PUT, :73 DELETE; [id]/favorite.ts:17 POST findOrCreate,
   :31 DELETE — workouts mirror :help/index.ts:32 visibleAudiences, :43 GET isPublished/audience filter, :105 POST withAdmin conflict check + sanit; help/[slug].ts:25 loadArticle черновик→404, :44 GET,
  :49 PUT, :77 DELETE
  Компоненты: src/components/recipes/RecipeForm.tsx:5 values, :45 handleSubmit trim+local issues, :83 render; RecipeCard.tsx:13 splitLines, :30 preview 3, :42 render; FavoriteButton.tsx:4 active/busy/
  withLabel; workouts/WorkoutForm.tsx:5 mirror; WorkoutCard.tsx:13 splitLines preview 3; help/HelpForm.tsx:14 values, :51 isContentEmpty, :73 handleTitleChange slugify, :81 handleSubmit, :258
  RichTextEditor; HelpCard.tsx:9 badges+summary; editor/RichTextEditor.tsx:5 Quill toolbar 12-20, :43 dynamic import; attachments/AttachmentPlayers.tsx:7 audios/videos/files/pairId
  Страницы: src/pages/recipes/index.tsx:14 PAGE_SIZE 12, :30 state, :48 debounce 350, :58 load, :109 toggleFavorite, :164 header, :184 toolbar search; [id].tsx:11 splitLines ul/ol, :34 load, :61
  toggleFavorite, :96 delete, :139 article; [id]/edit.tsx:12 load+put; new.tsx:12 guard+post; workouts mirror; help/index.tsx:29 HelpPage, :40 initAuth, :52 load, :91 isAdmin; help/[slug].tsx:19
  HelpArticlePage, :32 load+related, :103 dangerouslySetInnerHTML; admin/help/index.tsx:15 AdminHelpPage all=1 table, new.tsx:8 AdminHelpNew, [slug].tsx:13 toFormValues
  Документация: DOC/entities-and-relations.md:372 контент как санированный HTML, DOC/architecture.md:312 HelpArticle разделы/аудитории/админка

  ▣  Explore · Muse Spark 1.2 Free · 1m 1s

┃
┃  Explore (2 of 3) 90.5K (9%)                                                                                                                                            Parent up  Prev left  Next right
┃

     → Read src/types/participantDay.ts
     ✱ Glob "DB/models/*" in . (20 matches)
     ✱ Grep "image|sanitize|sanitizeRich|dangerouslySetInnerHTML|quill|Quill" in src (44 matches)
     → Read package.json
     → Read DB/models/TemplateAttachment.ts
     → Read DB/models/TemplateDay.ts
     → Read src/lib/sanitize.ts
     → Read DOC/participant-day-refactor-plan.md
     → Read DOC/report-extension-plan.md
     → Read DOC/css-refactor-plan.md
     → Read DOC/decisions-log.md
     → Read DOC/architecture.md
     → Read DOC/entities-and-relations.md
     → Read DOC/implementation-plan.md
     ✱ Grep "image" in . (4 matches)
     → Read src/components/day/KinescopePlayer.module.css
     → Read src/components/day/DayMaterials.module.css
     → Read src/lib/sanitize.ts
     → Read src/pages/api/marathons/[id]/days.ts
     ✱ Glob "DB/migrations/*.js" in . (21 matches)
     ✱ Grep "dangerouslySetInnerHTML|sanitize|sanitizeRichText|richText" in . (89 matches)
     → Read src/styles/globals.css

     Thought · 2.4s

     Thought · 180ms

     → Read DOC/plan-dorabotok.md
     → Read DOC/help-center-plan.md
     → Read DOC/product-vision.md
     → Read DOC/screens-and-ui.md
     ✱ Grep "img|image|picture|\.png|\.jpg|\.jpeg|\.webp" in . (7 matches)

     + Thought: 4.8s

     + Thought: 596ms

     → Read docker-compose.yml
     → Read Dockerfile
     → Read src/components/editor/RichTextEditor.module.css
     → Read src/components/attachments/AttachmentPlayers.module.css

     Thought · 544ms

     Marathon Platform — Rendering & Upload Infrastructure — Detailed Findings


  ┃
  ┃  Explore (3 of 3) 92.4K (9%)                                                                                                                                            Parent up  Prev left  Next right
  ┃
