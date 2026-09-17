import { useState, type FormEvent } from 'react';
import { ApiClientError } from '@/lib/apiClient';
import { slugifyHelpTitle } from '@/lib/helpSlug';
import RichTextEditor from '@/components/editor/RichTextEditor';
import Button from '@/components/ui/Button';
import {
  HELP_AUDIENCE_LABELS,
  HELP_SECTION_LABELS,
  HELP_SECTION_ORDER,
  type HelpAudience,
  type HelpSection,
} from '@/types/help';
import styles from './HelpForm.module.css';

export type HelpFormValues = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  section: HelpSection;
  audience: HelpAudience;
  position: number;
  isPublished: boolean;
};

type HelpFormProps = {
  initialValues?: HelpFormValues;
  submitLabel: string;
  onSubmit: (values: HelpFormValues) => Promise<void>;
  onCancel: () => void;
};

const EMPTY_VALUES: HelpFormValues = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  section: 'rules',
  audience: 'all',
  position: 0,
  isPublished: true,
};

const AUDIENCE_OPTIONS: HelpAudience[] = [
  'all',
  'participant',
  'mentor',
  'admin',
];

/** HTML из Quill считаем пустым, если в нём нет текста. */
function isContentEmpty(html: string): boolean {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .length === 0;
}

export default function HelpForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: HelpFormProps) {
  const [values, setValues] = useState<HelpFormValues>(
    initialValues ?? EMPTY_VALUES
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});

  function handleTitleChange(title: string) {
    setValues((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugifyHelpTitle(title),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIssues({});

    const trimmed: HelpFormValues = {
      ...values,
      title: values.title.trim(),
      slug: values.slug.trim(),
      summary: values.summary.trim(),
    };

    const localIssues: Record<string, string> = {};
    if (!trimmed.title) localIssues.title = 'Заголовок обязателен';
    if (!trimmed.slug) {
      localIssues.slug = 'Адрес статьи обязателен';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed.slug)) {
      localIssues.slug =
        'Только строчные латинские буквы, цифры и дефис';
    }
    if (isContentEmpty(trimmed.content)) {
      localIssues.content = 'Добавьте текст статьи';
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
          err instanceof Error ? err.message : 'Не удалось сохранить статью'
        );
      }
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="help-title" className={styles.label}>
          Заголовок <span className={styles.required}>*</span>
        </label>
        <input
          id="help-title"
          className="input"
          value={values.title}
          onChange={(event) => handleTitleChange(event.target.value)}
          maxLength={200}
          placeholder="Например: Дни замеров: что и когда заполнять"
        />
        {issues.title && <p className={styles.fieldError}>{issues.title}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="help-slug" className={styles.label}>
          Адрес статьи (URL) <span className={styles.required}>*</span>
        </label>
        <div className={styles.slugRow}>
          <span className={styles.slugPrefix}>/help/</span>
          <input
            id="help-slug"
            className={`input ${styles.slugInput}`}
            value={values.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setValues((prev) => ({ ...prev, slug: event.target.value }));
            }}
            maxLength={200}
            placeholder="dni-zamerov"
          />
        </div>
        <p className={styles.hint}>
          Подставляется из заголовка автоматически, можно изменить вручную.
        </p>
        {issues.slug && <p className={styles.fieldError}>{issues.slug}</p>}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="help-section" className={styles.label}>
            Раздел
          </label>
          <select
            id="help-section"
            className="input"
            value={values.section}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                section: event.target.value as HelpSection,
              }))
            }
          >
            {HELP_SECTION_ORDER.map((section) => (
              <option key={section} value={section}>
                {HELP_SECTION_LABELS[section]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="help-audience" className={styles.label}>
            Кому адресована
          </label>
          <select
            id="help-audience"
            className="input"
            value={values.audience}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                audience: event.target.value as HelpAudience,
              }))
            }
          >
            {AUDIENCE_OPTIONS.map((audience) => (
              <option key={audience} value={audience}>
                {HELP_AUDIENCE_LABELS[audience]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="help-position" className={styles.label}>
            Порядок вывода
          </label>
          <input
            id="help-position"
            type="number"
            className="input"
            value={values.position}
            min={0}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                position: Number.parseInt(event.target.value, 10) || 0,
              }))
            }
          />
          <p className={styles.hint}>Меньше — выше в списке раздела.</p>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="help-summary" className={styles.label}>
          Краткое описание
        </label>
        <textarea
          id="help-summary"
          className={`input ${styles.textareaSmall}`}
          value={values.summary}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, summary: event.target.value }))
          }
          maxLength={500}
          placeholder="Одна-две строки для карточки в списке (необязательно)"
        />
        {issues.summary && (
          <p className={styles.fieldError}>{issues.summary}</p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Текст статьи <span className={styles.required}>*</span>
        </label>
        <RichTextEditor
          value={values.content}
          onChange={(html) => setValues((prev) => ({ ...prev, content: html }))}
          placeholder="Правила, порядок действий, примеры..."
        />
        {issues.content && (
          <p className={styles.fieldError}>{issues.content}</p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={values.isPublished}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                isPublished: event.target.checked,
              }))
            }
          />
          Опубликовать статью (снять галочку, чтобы сохранить черновик)
        </label>
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
