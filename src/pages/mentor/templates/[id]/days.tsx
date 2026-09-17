import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import styles from '../../TemplateDays.module.css';
import { apiFetch } from '@/lib/apiClient';
import RichTextEditor from '@/components/editor/RichTextEditor';
import AttachmentsEditor from '@/components/mentor/AttachmentsEditor';
import Button from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui';
import { canEditMarathonTemplate } from '@/lib/templateStatus';
import type { AttachmentData } from '@/types/attachments';
import { Icon } from '@/components/icons';

type Template = {
  id: string;
  title: string;
  durationDays: number;
  status: 'draft' | 'pending_review' | 'approved';
};

type DayInput = {
  dayNumber: number;
  textContent: string;
  isMeasurementDay: boolean;
  isTrainingDay: boolean;
  isRestDay: boolean;
  isHealthyEatingDay: boolean;
  attachments: AttachmentData[];
};

type ApiDay = {
  id: string;
  dayNumber: number;
  textContent: string | null;
  isMeasurementDay: boolean;
  isTrainingDay: boolean;
  isRestDay: boolean;
  isHealthyEatingDay: boolean;
  attachments: AttachmentData[];
};

function createEmptyDays(count: number): DayInput[] {
  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    textContent: '',
    isMeasurementDay: false,
    isTrainingDay: false,
    isRestDay: false,
    isHealthyEatingDay: false,
    attachments: [],
  }));
}

function toPayloadAttachment(attachment: AttachmentData) {
  return {
    kind: attachment.kind,
    url: attachment.url,
    fileName: attachment.fileName ?? null,
    mimeType: attachment.mimeType ?? null,
    sizeBytes: attachment.sizeBytes ?? null,
    position: attachment.position,
    pairId: attachment.pairId ?? null,
    description: attachment.description ?? null,
  };
}

export default function TemplateDaysPage() {
  const router = useRouter();
  const { id } = router.query;
  const templateId = typeof id === 'string' ? id : undefined;

  const [template, setTemplate] = useState<Template | null>(null);
  const [days, setDays] = useState<DayInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'mentor') {
      router.push('/login');
      return;
    }

    if (!templateId) return;

    async function load() {
      try {
        const res = await apiFetch(`/api/marathons/${templateId}`, {
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить шаблон');
        }

        const data = json.data as Template & { days: ApiDay[] };
        setTemplate(data);

        if (data.days && data.days.length > 0) {
          setDays(
            data.days.map((day) => ({
              dayNumber: day.dayNumber,
              textContent: day.textContent || '',
              isMeasurementDay: day.isMeasurementDay || false,
              isTrainingDay: (day as ApiDay).isTrainingDay || false,
              isRestDay: (day as ApiDay).isRestDay || false,
              isHealthyEatingDay: (day as ApiDay).isHealthyEatingDay || false,
              attachments: day.attachments || [],
            }))
          );
        } else {
          setDays(createEmptyDays(data.durationDays));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router, templateId]);

  function updateDay(index: number, field: keyof DayInput, value: string | number | boolean | AttachmentData[]) {
    setDays((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function updateDayAttachments(index: number, attachments: AttachmentData[]) {
    updateDay(index, 'attachments', attachments);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!templateId) return;

    setError(null);
    setSaving(true);

    try {
      const res = await apiFetch(`/api/marathons/${templateId}/days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          days: days.map((day) => ({
            dayNumber: day.dayNumber,
            textContent: day.textContent,
            isMeasurementDay: day.isMeasurementDay,
            isTrainingDay: day.isTrainingDay,
            isRestDay: day.isRestDay,
            isHealthyEatingDay: day.isHealthyEatingDay,
            attachments: day.attachments.map(toPayloadAttachment),
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось сохранить дни');
      }

      alert('Дни успешно сохранены');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!templateId) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch(`/api/marathons/${templateId}/submit`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось отправить шаблон');
      }

      router.push('/mentor/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.main}>
        <p>Загрузка...</p>
      </main>
    );
  }

  if (error && !template) {
    return (
      <main className={styles.main}>
        <p className={styles.error}>{error}</p>
        <ButtonLink href="/mentor/templates" variant="outline">
          Назад к шаблонам
        </ButtonLink>
      </main>
    );
  }

  if (!template) {
    return (
      <main className={styles.main}>
        <p>Шаблон не найден.</p>
      </main>
    );
  }

  const isEditable = canEditMarathonTemplate(template.status);

  return (
    <main className={styles.main}>
      <h1>Шаг 3 из 3. Дни: {template.title}</h1>
      <p>
        Длительность: {template.durationDays} дн. Для каждого дня можно написать текст в
        редакторе, прикрепить независимые PDF, и добавить аудио/видео — каждое с
        опциональным описанием и PDF рядом. День можно оставить пустым.
      </p>

      {template.status === 'approved' && (
        <p className="textMuted">
          Шаблон одобрен. Изменения сохранятся сразу и будут видны во всех потоках.
        </p>
      )}

      <ButtonLink href={`/mentor/templates/${templateId}/intro`} variant="outline">
        ← Назад к предстартовой странице
      </ButtonLink>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSave}>
        {days.map((day, index) => (
          <fieldset key={index} className={styles.fieldset}>
            <legend>День {day.dayNumber}</legend>
            <div className={styles.dayFlags}>
              {/* diet_food — всегда первым в ряду иконок */}
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={day.isHealthyEatingDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(index, 'isHealthyEatingDay', e.target.checked)
                  }
                />
                <Icon name="diet_food" width={32} height={32} />
                <span>День здоровой еды</span>
              </label>
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={day.isMeasurementDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(index, 'isMeasurementDay', e.target.checked)
                  }
                />
                <Icon name="mesure" width={32} height={32} />
                <span>День замера</span>
              </label>
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={day.isTrainingDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(index, 'isTrainingDay', e.target.checked)
                  }
                />
                <Icon name="training" width={32} height={32} />
                <span>День тренировки</span>
              </label>
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={day.isRestDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(index, 'isRestDay', e.target.checked)
                  }
                />
                <Icon name="rest" width={32} height={32} />
                <span>День отдыха</span>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor={`text-${index}`}>Текстовое содержимое (визуальный редактор)</label>
              <RichTextEditor
                value={day.textContent}
                onChange={(html) => updateDay(index, 'textContent', html)}
                disabled={!isEditable}
                placeholder="Текст дня..."
              />
            </div>

            {templateId && (
              <div className={styles.attachmentsRow}>
                <AttachmentsEditor
                  templateId={templateId}
                  kinds={['image', 'file', 'audio', 'video']}
                  attachments={day.attachments}
                  onChange={(attachments) => updateDayAttachments(index, attachments)}
                  disabled={!isEditable}
                />
              </div>
            )}
          </fieldset>
        ))}

        <div className={styles.buttonRow}>
          {isEditable && (
            <Button type="submit" variant="primary" loading={saving}>
              {saving ? 'Сохранение...' : 'Сохранить дни'}
            </Button>
          )}
          {template.status === 'draft' && (
            <Button
              type="button"
              variant="success"
              loading={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Отправка...' : 'Отправить на проверку'}
            </Button>
          )}
          <ButtonLink href="/mentor/templates" variant="outline">
            Назад к шаблонам
          </ButtonLink>
        </div>
      </form>
    </main>
  );
}
