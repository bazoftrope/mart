import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import styles from '../../TemplateDays.module.css';
import { apiFetch } from '@/lib/apiClient';
import RichTextEditor from '@/components/editor/RichTextEditor';
import AttachmentsEditor from '@/components/mentor/AttachmentsEditor';
import DayNavbar from '@/components/marathon/DayNavbar';
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

function hasDayContent(day: DayInput) {
  const text = day.textContent
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text.length > 0 || day.attachments.length > 0;
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
  const [activeDay, setActiveDay] = useState<number | null>(null);
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
          const daysByNumber = new Map(data.days.map((day) => [day.dayNumber, day]));
          const filledDays = createEmptyDays(data.durationDays).map((emptyDay) => {
            const day = daysByNumber.get(emptyDay.dayNumber);
            if (!day) return emptyDay;
            return {
              dayNumber: day.dayNumber,
              textContent: day.textContent || '',
              isMeasurementDay: day.isMeasurementDay || false,
              isTrainingDay: day.isTrainingDay || false,
              isRestDay: day.isRestDay || false,
              isHealthyEatingDay: day.isHealthyEatingDay || false,
              attachments: day.attachments || [],
            };
          });
          setDays(filledDays);
          setActiveDay(filledDays[0]?.dayNumber ?? null);
        } else {
          const emptyDays = createEmptyDays(data.durationDays);
          setDays(emptyDays);
          setActiveDay(emptyDays[0]?.dayNumber ?? null);
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
  const activeDayIndex = days.findIndex((day) => day.dayNumber === activeDay);
  const activeDayData = activeDayIndex >= 0 ? days[activeDayIndex] : null;
  const measurementDays = days
    .filter((day) => day.isMeasurementDay)
    .map((day) => day.dayNumber);
  const trainingDays = days
    .filter((day) => day.isTrainingDay)
    .map((day) => day.dayNumber);
  const restDays = days.filter((day) => day.isRestDay).map((day) => day.dayNumber);
  const healthyEatingDays = days
    .filter((day) => day.isHealthyEatingDay)
    .map((day) => day.dayNumber);
  const filledDays = days.filter(hasDayContent).map((day) => day.dayNumber);

  return (
    <main className={styles.main}>
      <h1>Шаг 3 из 3. Дни: {template.title}</h1>
      <p>
        Длительность: {template.durationDays} дн. Выберите день в ленте ниже — редактор
        покажет только его. Для каждого дня можно написать текст, прикрепить независимые
        PDF, и добавить аудио/видео — каждое с опциональным описанием и одним или
        несколькими PDF рядом. День можно оставить пустым.
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

      <DayNavbar
        durationDays={template.durationDays}
        activeDay={activeDay}
        onDayChange={setActiveDay}
        measurementDays={measurementDays}
        trainingDays={trainingDays}
        restDays={restDays}
        healthyEatingDays={healthyEatingDays}
        filledDays={filledDays}
        ariaLabel="Дни шаблона"
      />

      <form onSubmit={handleSave}>
        {activeDayData ? (
          <fieldset key={activeDayData.dayNumber} className={styles.fieldset}>
            <legend>
              День {activeDayData.dayNumber} из {template.durationDays}
            </legend>
            <div className={styles.dayFlags}>
              {/* diet_food — всегда первым в ряду иконок */}
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={activeDayData.isHealthyEatingDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(activeDayIndex, 'isHealthyEatingDay', e.target.checked)
                  }
                />
                <Icon name="diet_food" width={32} height={32} />
                <span>День здоровой еды</span>
              </label>
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={activeDayData.isMeasurementDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(activeDayIndex, 'isMeasurementDay', e.target.checked)
                  }
                />
                <Icon name="mesure" width={32} height={32} />
                <span>День замера</span>
              </label>
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={activeDayData.isTrainingDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(activeDayIndex, 'isTrainingDay', e.target.checked)
                  }
                />
                <Icon name="training" width={32} height={32} />
                <span>День тренировки</span>
              </label>
              <label className={styles.flagLabel}>
                <input
                  type="checkbox"
                  checked={activeDayData.isRestDay}
                  disabled={!isEditable}
                  onChange={(e) =>
                    updateDay(activeDayIndex, 'isRestDay', e.target.checked)
                  }
                />
                <Icon name="rest" width={32} height={32} />
                <span>День отдыха</span>
              </label>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor={`text-${activeDayData.dayNumber}`}>
                Текстовое содержимое (визуальный редактор)
              </label>
              <RichTextEditor
                key={activeDayData.dayNumber}
                value={activeDayData.textContent}
                onChange={(html) => updateDay(activeDayIndex, 'textContent', html)}
                disabled={!isEditable}
                placeholder="Текст дня..."
              />
            </div>

            {templateId && (
              <div className={styles.attachmentsRow}>
                <AttachmentsEditor
                  templateId={templateId}
                  kinds={['image', 'file', 'audio', 'video']}
                  attachments={activeDayData.attachments}
                  onChange={(attachments) =>
                    updateDayAttachments(activeDayIndex, attachments)
                  }
                  disabled={!isEditable}
                />
              </div>
            )}
          </fieldset>
        ) : (
          <p>Дни не найдены.</p>
        )}

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
