import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiClientError } from '@/lib/apiClient';
import type { ContentAttachmentData } from '@/types/attachments';
import ContentAttachmentManager from '@/components/attachments/ContentAttachmentManager';
import Button from '@/components/ui/Button';
import styles from './RecipeForm.module.css';

export type RecipeFormValues = {
  title: string;
  description: string;
  ingredients: string;
  steps: string;
  attachments: ContentAttachmentData[];
};

type RecipeFormProps = {
  initialValues?: RecipeFormValues;
  submitLabel: string;
  onSubmit: (values: RecipeFormValues) => Promise<void>;
  onCancel: () => void;
};

const EMPTY_VALUES: RecipeFormValues = {
  title: '',
  description: '',
  ingredients: '',
  steps: '',
  attachments: [],
};

export default function RecipeForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: RecipeFormProps) {
  const [values, setValues] = useState<RecipeFormValues>(
    initialValues ?? EMPTY_VALUES
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});

  function updateField(field: keyof RecipeFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIssues({});

    const trimmed: RecipeFormValues = {
      title: values.title.trim(),
      description: values.description.trim(),
      ingredients: values.ingredients.trim(),
      steps: values.steps.trim(),
      attachments: values.attachments.map((a, idx) => ({ ...a, position: idx })),
    };

    const localIssues: Record<string, string> = {};
    if (!trimmed.title) localIssues.title = 'Название обязательно';
    if (!trimmed.ingredients) localIssues.ingredients = 'Добавьте ингредиенты';
    if (!trimmed.steps) localIssues.steps = 'Добавьте шаги приготовления';

    if (Object.keys(localIssues).length > 0) {
      setIssues(localIssues);
      return;
    }

    setSaving(true);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setIssues(err.issues ?? {});
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : 'Не удалось сохранить рецепт'
        );
      }
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="recipe-title" className={styles.label}>
          Название <span className={styles.required}>*</span>
        </label>
        <input
          id="recipe-title"
          className="input"
          value={values.title}
          onChange={updateField('title')}
          maxLength={200}
          placeholder="Например: Овсянка с ягодами и орехами"
        />
        {issues.title && <p className={styles.fieldError}>{issues.title}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="recipe-description" className={styles.label}>
          Короткое описание
        </label>
        <textarea
          id="recipe-description"
          className={`input ${styles.textareaSmall}`}
          value={values.description}
          onChange={updateField('description')}
          maxLength={2000}
          placeholder="Пара слов о блюде (необязательно)"
        />
        {issues.description && (
          <p className={styles.fieldError}>{issues.description}</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="recipe-ingredients" className={styles.label}>
          Ингредиенты <span className={styles.required}>*</span>
        </label>
        <textarea
          id="recipe-ingredients"
          className={`input ${styles.textarea}`}
          value={values.ingredients}
          onChange={updateField('ingredients')}
          maxLength={10000}
          placeholder={'Овсяные хлопья — 50 г\nМолоко — 150 мл\nЯгоды — 50 г'}
        />
        <p className={styles.hint}>Каждый ингредиент — с новой строки.</p>
        {issues.ingredients && (
          <p className={styles.fieldError}>{issues.ingredients}</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="recipe-steps" className={styles.label}>
          Приготовление <span className={styles.required}>*</span>
        </label>
        <textarea
          id="recipe-steps"
          className={`input ${styles.textarea}`}
          value={values.steps}
          onChange={updateField('steps')}
          maxLength={20000}
          placeholder={
            'Залейте хлопья молоком.\nВарите 5 минут на медленном огне.\nДобавьте ягоды и орехи.'
          }
        />
        <p className={styles.hint}>Каждый шаг — с новой строки.</p>
        {issues.steps && <p className={styles.fieldError}>{issues.steps}</p>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Галерея изображений</label>
        <ContentAttachmentManager
          kind="image"
          label="Изображения (jpg, png, webp)"
          attachments={values.attachments}
          onChange={(next) => setValues((prev) => ({ ...prev, attachments: next }))}
        />
        <p className={styles.hint}>До 10 МБ на файл, до 10 изображений. Показываются галереей.</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Видео</label>
        <ContentAttachmentManager
          kind="video"
          label="Видео (ссылка Kinescope)"
          attachments={values.attachments}
          onChange={(next) => setValues((prev) => ({ ...prev, attachments: next }))}
        />
        <p className={styles.hint}>
          Вставьте ссылку https://kinescope.io/... — видео покажется плеером.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>PDF-файлы</label>
        <ContentAttachmentManager
          kind="file"
          label="PDF"
          attachments={values.attachments}
          onChange={(next) => setValues((prev) => ({ ...prev, attachments: next }))}
        />
        <p className={styles.hint}>Рецепт в PDF, до 25 МБ на файл.</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Сохраняем...' : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
