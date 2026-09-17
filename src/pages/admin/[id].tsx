import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import type { PublicUser } from '@/types/auth';
import type { AttachmentData } from '@/types/attachments';
import { useAuthStore } from '@/stores/authStore';
import styles from './AdminReviewTemplate.module.css';
import { apiFetch } from '@/lib/apiClient';
import AttachmentPlayers from '@/components/attachments/AttachmentPlayers';
import { Icon } from '@/components/icons';

type TemplateDay = {
  id: string;
  dayNumber: number;
  textContent?: string;
  isMeasurementDay?: boolean;
  isTrainingDay?: boolean;
  isRestDay?: boolean;
  isHealthyEatingDay?: boolean;
  attachments: AttachmentData[];
};

type TemplateDetail = {
  id: string;
  title: string;
  description?: string;
  durationDays: number;
  status: string;
  introText: string | null;
  introAttachments: AttachmentData[];
  createdAt: string;
  updatedAt: string;
  mentor: PublicUser | null;
  days: TemplateDay[];
};

export default function AdminReviewTemplatePage() {
  const router = useRouter();
  const { id } = router.query;
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'admin') {
      router.push('/login');
      return;
    }

    if (!id || typeof id !== 'string') return;

    async function load() {
      try {
        const res = await apiFetch(`/api/admin/pending/${id}`, {
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить шаблон');
        }

        setTemplate(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, router]);

  async function handleApprove() {
    if (!template || typeof id !== 'string') return;

    setApproving(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/admin/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось одобрить шаблон');
      }

      setApproved(true);
      setTimeout(() => {
        router.push('/admin');
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setApproving(false);
    }
  }

  function renderText(text: string | null | undefined) {
    if (!text) return null;
    return <div className={styles.richText} dangerouslySetInnerHTML={{ __html: text }} />;
  }

  return (
    <main className={styles.main}>
      <p>
        <Link href="/admin">← Назад к списку</Link>
      </p>
      <h1>Проверка шаблона</h1>
      {loading && <p>Загрузка...</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !template && !error && <p>Шаблон не найден.</p>}
      {template && (
        <>
          <section className={styles.section}>
            <h2>{template.title}</h2>
            {template.description && <p>{template.description}</p>}
            <p>
              <strong>Длительность:</strong> {template.durationDays} дн.
            </p>
            <p>
              <strong>Ментор:</strong>{' '}
              {template.mentor
                ? `${template.mentor.name} (${template.mentor.email})`
                : 'Неизвестно'}
            </p>
            <p>
              <strong>Статус:</strong> {template.status}
            </p>
          </section>

          {(template.introText || template.introAttachments.length > 0) && (
            <section className={styles.section}>
              <h3>Предстартовая страница</h3>
              {renderText(template.introText)}
              {template.introAttachments.length > 0 ? (
                <AttachmentPlayers attachments={template.introAttachments} />
              ) : (
                <p className={styles.muted}>Вложений нет.</p>
              )}
            </section>
          )}

          <section className={styles.section}>
            <h3>Дни</h3>
            {template.days.length === 0 && <p>Дни не настроены.</p>}
            {template.days.map((day) => (
              <article key={day.id} className={styles.card}>
                <h4 className={styles.cardTitle}>
                  День {day.dayNumber}
                  <span className={styles.badgeRow}>
                    {/* diet_food — всегда первым в ряду иконок */}
                    {day.isHealthyEatingDay && (
                      <span className={styles.badgeHealthy} title="День здоровой еды">
                        <Icon name="diet_food" width={18} height={18} /> здоровая еда
                      </span>
                    )}
                    {day.isMeasurementDay && (
                      <span className={styles.measurementBadge} title="День замера">
                        <Icon name="mesure" width={18} height={18} /> замер
                      </span>
                    )}
                    {day.isTrainingDay && (
                      <span className={styles.badgeTraining} title="День тренировки">
                        <Icon name="training" width={18} height={18} /> тренировка
                      </span>
                    )}
                    {day.isRestDay && (
                      <span className={styles.badgeRest} title="День отдыха">
                        <Icon name="rest" width={18} height={18} /> отдых
                      </span>
                    )}
                  </span>
                </h4>
                {day.textContent ? (
                  renderText(day.textContent)
                ) : day.attachments.length === 0 ? (
                  <p className={styles.muted}>Нет содержимого</p>
                ) : null}
                {day.attachments.length > 0 ? (
                  <AttachmentPlayers attachments={day.attachments} />
                ) : (
                  <p className={styles.muted}>Вложений нет.</p>
                )}
              </article>
            ))}
          </section>

          {approved ? (
            <p className={styles.success}>
              Шаблон одобрен. Перенаправление...
            </p>
          ) : (
            <button
              onClick={handleApprove}
              disabled={approving}
              className={styles.approveBtn}
            >
              {approving ? 'Одобрение...' : 'Одобрить шаблон'}
            </button>
          )}
        </>
      )}
    </main>
  );
}
