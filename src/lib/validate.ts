import { z } from 'zod';
import { normalizeKinescopeVideoId } from './kinescope';

export const emailSchema = z
  .string()
  .email('Неверный email')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(6, 'Пароль должен быть не менее 6 символов');

export const nameSchema = z
  .string()
  .min(1, 'Имя обязательно')
  .max(255, 'Имя слишком длинное');

export const roleSchema = z
  .enum(['participant', 'mentor'])
  .default('participant');

export const sexSchema = z.enum(['male', 'female']);

export const goalSchema = z.enum(['lose', 'maintain', 'gain']);

export const consentTypeSchema = z.enum(['general', 'health']);

/**
 * Обязательная галочка согласия. Значение `true` подтверждает, что
 * пользователь осознанно дал согласие; иначе сервер отклоняет запрос.
 */
const requiredConsent = (message: string) =>
  z.boolean().refine((value) => value === true, { message });

export const grantConsentSchema = z.object({
  type: consentTypeSchema,
});

export const profileSchema = z.object({
  sex: sexSchema,
  heightCm: z
    .number()
    .int('Рост должен быть целым числом')
    .min(50, 'Рост должен быть не менее 50 см')
    .max(250, 'Рост должен быть не более 250 см'),
  weightKg: z
    .number()
    .min(20, 'Вес должен быть не менее 20 кг')
    .max(300, 'Вес должен быть не более 300 кг'),
  age: z
    .number()
    .int('Возраст должен быть целым числом')
    .min(18, 'Сервис доступен только с 18 лет')
    .max(120, 'Возраст должен быть не более 120 лет'),
  healthConsentAccepted: requiredConsent(
    'Нужно согласие на обработку данных о здоровье'
  ),
});

export const enrollSchema = z.object({
  goal: goalSchema,
});

export const idSchema = z.coerce.number().int().positive('Неверный id');

export const uuidSchema = z.string().uuid('Неверный uuid');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: roleSchema,
  acceptPolicy: requiredConsent(
    'Нужно подтвердить ознакомление с политикой обработки персональных данных'
  ),
  acceptGeneralConsent: requiredConsent(
    'Нужно согласие на обработку персональных данных'
  ),
});

/** Подтверждение удаления аккаунта: пароль + контрольное слово. */
export const deleteAccountSchema = z.object({
  password: passwordSchema,
  confirmation: z
    .string()
    .trim()
    .refine((value) => value.toLowerCase() === 'удалить', {
      message: 'Введите слово «удалить» для подтверждения',
    }),
});

export const templateAttachmentSchema = z
  .object({
    kind: z.enum(['audio', 'video', 'file', 'image']),
    url: z.string().trim().min(1, 'Ссылка вложения обязательна').max(2048, 'Ссылка вложения слишком длинная'),
    fileName: z.string().max(512, 'Имя файла слишком длинное').nullable().optional(),
    mimeType: z.string().max(255, 'MIME-тип слишком длинный').nullable().optional(),
    sizeBytes: z.number().int().nonnegative('Некорректный размер файла').nullable().optional(),
    position: z.number().int().nonnegative('Некорректная позиция').optional(),
    pairId: z.string().uuid('Неверный идентификатор комплекта').nullable().optional(),
    description: z.string().max(5000, 'Описание слишком длинное').nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.kind !== 'video') return true;
      return Boolean(normalizeKinescopeVideoId(data.url));
    },
    {
      message: 'Вставьте корректную ссылку Kinescope (https://kinescope.io/...)',
      path: ['url'],
    }
  )
  .transform((data) => {
    if (data.kind === 'video') {
      return { ...data, url: normalizeKinescopeVideoId(data.url)! };
    }
    return data;
  });

export const marathonTemplateSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(255, 'Название слишком длинное'),
  description: z.string().max(5000, 'Описание слишком длинное').optional(),
  durationDays: z.number().int().min(1, 'Длительность должна быть не менее 1 дня').max(365, 'Длительность слишком большая'),
  introText: z.string().max(50000, 'Приветственный текст слишком длинный').optional(),
  introAttachments: z.array(templateAttachmentSchema).optional(),
});

export const templateDaySchema = z.object({
  dayNumber: z.number().int().min(1, 'Номер дня должен быть не менее 1'),
  textContent: z.string().max(50000, 'Содержимое слишком длинное').optional(),
  isMeasurementDay: z.boolean().optional().default(false),
  isTrainingDay: z.boolean().optional().default(false),
  isRestDay: z.boolean().optional().default(false),
  isHealthyEatingDay: z.boolean().optional().default(false),
  attachments: z.array(templateAttachmentSchema).optional(),
});

export const updateTemplateDaysSchema = z.object({
  days: z.array(templateDaySchema).min(1, 'Необходим хотя бы один день'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type GrantConsentInput = z.infer<typeof grantConsentSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type EnrollInput = z.infer<typeof enrollSchema>;
export type MarathonTemplateInput = z.infer<typeof marathonTemplateSchema>;
export type TemplateDayInput = z.infer<typeof templateDaySchema>;
export type TemplateAttachmentInput = z.infer<typeof templateAttachmentSchema>;
export const createStreamSchema = z.object({
  templateId: z.string().uuid('Неверный id шаблона'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата начала должна быть в формате ГГГГ-ММ-ДД'),
});

export const contentAttachmentSchema = z
  .object({
    kind: z.enum(['file', 'image', 'audio', 'video']),
    url: z.string().trim().min(1, 'Ссылка вложения обязательна').max(2048, 'Ссылка вложения слишком длинная'),
    fileName: z.string().max(512, 'Имя файла слишком длинное').nullable().optional(),
    mimeType: z.string().max(255, 'MIME-тип слишком длинный').nullable().optional(),
    sizeBytes: z.number().int().nonnegative('Некорректный размер файла').nullable().optional(),
    position: z.number().int().nonnegative('Некорректная позиция').optional(),
    pairId: z.string().uuid('Неверный идентификатор комплекта').nullable().optional(),
    description: z.string().max(5000, 'Описание слишком длинное').nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.kind !== 'video') return true;
      return Boolean(normalizeKinescopeVideoId(data.url));
    },
    {
      message: 'Вставьте корректную ссылку Kinescope (https://kinescope.io/...)',
      path: ['url'],
    }
  )
  .transform((data) => {
    if (data.kind === 'video') {
      return { ...data, url: normalizeKinescopeVideoId(data.url)! };
    }
    return data;
  });

export const recipeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Название обязательно')
    .max(200, 'Название слишком длинное'),
  description: z
    .string()
    .trim()
    .max(2000, 'Описание слишком длинное')
    .optional(),
  ingredients: z
    .string()
    .trim()
    .min(1, 'Добавьте ингредиенты')
    .max(10000, 'Список ингредиентов слишком длинный'),
  steps: z
    .string()
    .trim()
    .min(1, 'Добавьте шаги приготовления')
    .max(20000, 'Описание шагов слишком длинное'),
  attachments: z.array(contentAttachmentSchema).optional(),
});

export const workoutSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Название обязательно')
    .max(200, 'Название слишком длинное'),
  description: z
    .string()
    .trim()
    .max(2000, 'Описание слишком длинное')
    .optional(),
  exercises: z
    .string()
    .trim()
    .min(1, 'Добавьте упражнения')
    .max(10000, 'Список упражнений слишком длинный'),
  execution: z
    .string()
    .trim()
    .min(1, 'Добавьте порядок выполнения')
    .max(20000, 'Описание выполнения слишком длинное'),
  attachments: z.array(contentAttachmentSchema).optional(),
});

export const helpArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Заголовок обязателен')
    .max(200, 'Заголовок слишком длинный'),
  slug: z
    .string()
    .trim()
    .min(1, 'Адрес статьи обязателен')
    .max(200, 'Адрес статьи слишком длинный')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Адрес может содержать только строчные латинские буквы, цифры и дефис'
    ),
  summary: z
    .string()
    .trim()
    .max(500, 'Краткое описание слишком длинное')
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, 'Добавьте текст статьи')
    .max(50000, 'Текст статьи слишком длинный'),
  section: z.enum(['rules', 'faq', 'guide']),
  audience: z.enum(['all', 'participant', 'mentor', 'admin']),
  position: z
    .number()
    .int('Позиция должна быть целым числом')
    .min(0, 'Позиция не может быть отрицательной')
    .max(100000, 'Позиция слишком большая')
    .optional()
    .default(0),
  isPublished: z.boolean().optional().default(true),
});

const macroField = z
  .number()
  .min(0, 'Значение не может быть отрицательным')
  .max(100, 'Значение не может быть больше 100 г');

export const createProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Название продукта обязательно')
      .max(200, 'Название слишком длинное'),
    calories: z
      .number()
      .positive('Калорийность должна быть положительной')
      .max(2000, 'Калорийность слишком большая'),
    protein: macroField,
    fat: macroField,
    carbs: macroField,
  })
  .refine((data) => data.protein + data.fat + data.carbs <= 100, {
    message: 'Сумма белков, жиров и углеводов не может превышать 100 г',
    path: ['protein'],
  });

export const mealTypeSchema = z.enum([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]);

export const reportLineSchema = z.object({
  productId: z.string().uuid('Неверный id продукта'),
  mealType: mealTypeSchema,
  weightGrams: z
    .number()
    .positive('Вес должен быть положительным')
    .max(999999, 'Вес слишком большой'),
});

export const pulseReadingSchema = z
  .object({
    measuredAt: z.string().datetime('Неверный формат даты измерения'),
    pulse: z
      .number()
      .int()
      .min(30, 'Пульс должен быть не менее 30')
      .max(250, 'Пульс должен быть не более 250')
      .nullable()
      .optional(),
    systolic: z
      .number()
      .int('Систолическое давление должно быть целым')
      .min(60, 'Систолическое давление должно быть не менее 60')
      .max(250, 'Систолическое давление должно быть не более 250')
      .nullable()
      .optional(),
    diastolic: z
      .number()
      .int('Диастолическое давление должно быть целым')
      .min(40, 'Диастолическое давление должно быть не менее 40')
      .max(160, 'Диастолическое давление должно быть не более 160')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      const hasPulse = data.pulse !== undefined && data.pulse !== null;
      const hasSys = data.systolic !== undefined && data.systolic !== null;
      const hasDia = data.diastolic !== undefined && data.diastolic !== null;
      // нужен хотя бы пульс или давление
      if (!hasPulse && !hasSys && !hasDia) return false;
      // если указано давление — нужны оба значения
      if ((hasSys || hasDia) && !(hasSys && hasDia)) return false;
      if (hasSys && hasDia) return (data.systolic as number) > (data.diastolic as number);
      return true;
    },
    {
      message: 'Укажите пульс или оба значения давления (сист. > диаст.)',
      path: ['pulse'],
    }
  );

const reportCoreFields = {
  lines: z.array(reportLineSchema).optional(),
  waterLiters: z.number().int().min(0).max(50, 'Объём воды не может превышать 50 литров').optional(),
  steps: z.number().int().min(0).max(100000, 'Количество шагов не может превышать 100000').optional(),
  sleepHours: z.number().int().min(0).max(24, 'Сон не может превышать 24 часа').optional(),
  activityMinutes: z.number().int().min(0).max(1440, 'Активность не может превышать 1440 минут').optional(),
  trainingDone: z.boolean().nullable().optional(),
  weightKg: z.number().int().min(20, 'Вес должен быть не менее 20 кг').max(300, 'Вес должен быть не более 300 кг').optional(),
  chestCm: z.number().min(30, 'ОГ должен быть не менее 30 см').max(300, 'ОГ должен быть не более 300 см').optional(),
  waistCm: z.number().min(30, 'ОТ должен быть не менее 30 см').max(300, 'ОТ должен быть не более 300 см').optional(),
  hipCm: z.number().min(30, 'ОБ должен быть не менее 30 см').max(300, 'ОБ должен быть не более 300 см').optional(),
  legCm: z.number().min(20, 'ОН должен быть не менее 20 см').max(200, 'ОН должен быть не более 200 см').optional(),
} as const;

export const saveReportCoreSchema = z
  .object(reportCoreFields)
  .refine(
    (data) => {
      const hasLines = Array.isArray(data.lines) && data.lines.length > 0;
      const hasMetrics =
        data.waterLiters !== undefined ||
        data.steps !== undefined ||
        data.sleepHours !== undefined ||
        data.activityMinutes !== undefined ||
        (data.trainingDone !== undefined && data.trainingDone !== null) ||
        data.weightKg !== undefined ||
        data.chestCm !== undefined ||
        data.waistCm !== undefined ||
        data.hipCm !== undefined ||
        data.legCm !== undefined;
      return hasLines || hasMetrics;
    },
    {
      message: 'Необходимо указать хотя бы одно из: строки еды или метрики',
      path: ['root'],
    }
  );

export const saveReportSchema = z
  .object({
    ...reportCoreFields,
    pulseReadings: z.array(pulseReadingSchema).optional(),
  })
  .refine(
    (data) => {
      const hasLines = Array.isArray(data.lines) && data.lines.length > 0;
      const hasMetrics =
        data.waterLiters !== undefined ||
        data.steps !== undefined ||
        data.sleepHours !== undefined ||
        data.activityMinutes !== undefined ||
        (data.trainingDone !== undefined && data.trainingDone !== null) ||
        data.weightKg !== undefined ||
        data.chestCm !== undefined ||
        data.waistCm !== undefined ||
        data.hipCm !== undefined ||
        data.legCm !== undefined;
      const hasPulse = Array.isArray(data.pulseReadings) && data.pulseReadings.length > 0;
      return hasLines || hasMetrics || hasPulse;
    },
    {
      message: 'Необходимо указать хотя бы одно из: строки еды, метрики или замеры пульса',
      path: ['root'],
    }
  );

export const savePulseSchema = z.object({
  pulseReadings: z.array(pulseReadingSchema).max(20, 'Слишком много замеров за день'),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['mentor', 'participant']),
});

export const createConversationSchema = z
  .object({
    type: z.enum(['mentor_pair', 'group']),
    streamId: z.string().uuid('Неверный id потока').optional(),
    participantId: z.string().uuid('Неверный id участника').optional(),
  })
  .refine((data) => !!data.streamId, {
    message: 'Необходимо указать streamId',
    path: ['root'],
  });

export const sendMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Сообщение не может быть пустым')
    .max(5000, 'Сообщение слишком длинное'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export type CreateStreamInput = z.infer<typeof createStreamSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type RecipeInput = z.infer<typeof recipeSchema>;
export type WorkoutInput = z.infer<typeof workoutSchema>;
export type HelpArticleInput = z.infer<typeof helpArticleSchema>;
export type UpdateTemplateDaysInput = z.infer<typeof updateTemplateDaysSchema>;
export type ReportLineInput = z.infer<typeof reportLineSchema>;
export type PulseReadingInput = z.infer<typeof pulseReadingSchema>;
export type SaveReportInput = z.infer<typeof saveReportSchema>;
export type SaveReportCoreInput = z.infer<typeof saveReportCoreSchema>;
export type SavePulseInput = z.infer<typeof savePulseSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
