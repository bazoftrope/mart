import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiClientError } from '@/lib/apiClient';
import type { ContentAttachmentData } from '@/types/attachments';
import ContentAttachmentManager from '@/components/attachments/ContentAttachmentManager';
import Button from '@/components/ui/Button';
import styles from './WorkoutForm.module.css';

export type WorkoutFormValues = {
  title: string;
  description: string;
  exercises: string;
  execution: string;
  attachments: ContentAttachmentData[];
};

type WorkoutFormProps = {
  initialValues?: WorkoutFormValues;
  submitLabel: string;
  onSubmit: (values: WorkoutFormValues) => Promise<void>;
  onCancel: () => void;
};

const EMPTY_VALUES: WorkoutFormValues = {
  title: '',
  description: '',
  exercises: '',
  execution: '',
  attachments: [],
};

export default function WorkoutForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: WorkoutFormProps) {
  const [values, setValues] = useState<WorkoutFormValues>(
    initialValues ?? EMPTY_VALUES
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});

  function updateField(field: keyof WorkoutFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIssues({});

    const trimmed: WorkoutFormValues = {
      title: values.title.trim(),
      description: values.description.trim(),
      exercises: values.exercises.trim(),
      execution: values.execution.trim(),
      attachments: values.attachments.map((a, idx) => ({ ...a, position: idx })),
    };

    const localIssues: Record<string, string> = {};
    if (!trimmed.title) localIssues.title = 'Название обязательно';
    if (!trimmed.exercises) localIssues.exercises = 'Добавьте упражнения';
    if (!trimmed.execution) {
      localIssues.execution = 'Добавьте порядок выполнения';
    }

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
          err instanceof Error ? err.message : 'Не удалось сохранить тренировку'
        );
      }
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="workout-title" className={styles.label}>
          Название <span className={styles.required}>*</span>
        </label>
        <input
          id="workout-title"
          className="input"
          value={values.title}
          onChange={updateField('title')}
          maxLength={200}
          placeholder="Например: Функциональная тренировка всего тела"
        />
        {issues.title && <p className={styles.fieldError}>{issues.title}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="workout-description" className={styles.label}>
          Короткое описание
        </label>
        <textarea
          id="workout-description"
          className={`input ${styles.textareaSmall}`}
          value={values.description}
          onChange={updateField('description')}
          maxLength={2000}
          placeholder="Для кого тренировка и что она даёт (необязательно)"
        />
        {issues.description && (
          <p className={styles.fieldError}>{issues.description}</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="workout-exercises" className={styles.label}>
          Упражнения <span className={styles.required}>*</span>
        </label>
        <textarea
          id="workout-exercises"
          className={`input ${styles.textarea}`}
          value={values.exercises}
          onChange={updateField('exercises')}
          maxLength={10000}
          placeholder={'Приседания — 15 повторов\nОтжимания — 10 повторов\nПланка — 30 секунд'}
        />
        <p className={styles.hint}>Каждое упражнение — с новой строки.</p>
        {issues.exercises && (
          <p className={styles.fieldError}>{issues.exercises}</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="workout-execution" className={styles.label}>
          Порядок выполнения <span className={styles.required}>*</span>
        </label>
        <textarea
          id="workout-execution"
          className={`input ${styles.textarea}`}
          value={values.execution}
          onChange={updateField('execution')}
          maxLength={20000}
          placeholder={
            'Выполните упражнения по кругу без пауз.\nОтдохните 60 секунд и повторите 3 раза.'
          }
        />
        <p className={styles.hint}>Каждый шаг — с новой строки.</p>
        {issues.execution && (
          <p className={styles.fieldError}>{issues.execution}</p>
        )}
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
        <p className={styles.hint}>Тренировка в PDF, до 25 МБ на файл.</p>
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
