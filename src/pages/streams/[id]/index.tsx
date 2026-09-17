import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import styles from './index.module.css';
import { apiFetch } from '@/lib/apiClient';
import { HELP_SLUG_RULES } from '@/lib/helpSlug';
import AttachmentPlayers from '@/components/attachments/AttachmentPlayers';
import type { AttachmentData } from '@/types/attachments';

type StreamDetails = {
  id: string;
  startDate: string;
  status: string;
  createdAt: string;
  enrollmentsCount: number;
  isEnrolled: boolean;
  template: {
    id: string;
    title: string;
    description?: string;
    durationDays: number;
    status: string;
  } | null;
  intro: {
    text: string | null;
    attachments: AttachmentData[];
  } | null;
  mentor: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export default function StreamPage() {
  const router = useRouter();
  const { id } = router.query;
  const role = useAuthStore((s) => s.role);

  const [stream, setStream] = useState<StreamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
  }, []);

  useEffect(() => {
    if (!id) return;

    async function loadStream() {
      try {
        const res = await apiFetch(`/api/streams/${id}`, { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить поток');
        }
        setStream(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    loadStream();
  }, [id]);

  async function handleEnroll() {
    if (!stream) return;
    setEnrolling(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/streams/${stream.id}/enroll`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = json.message || json.error || 'Не удалось записаться';
        if (message.includes('анкету')) {
          router.push(`/onboarding?next=${encodeURIComponent(`/streams/${stream.id}`)}`);
          return;
        }
        throw new Error(message);
      }

      setStream({ ...stream, isEnrolled: true, enrollmentsCount: stream.enrollmentsCount + 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) return <main className="container"><p>Загрузка...</p></main>;
  if (error) return <main className="container"><p className="error">{error}</p></main>;
  if (!stream) return <main className="container"><p>Поток не найден</p></main>;

  const hasIntro =
    stream.intro &&
    (Boolean(stream.intro.text) || stream.intro.attachments.length > 0);

  return (
    <main className="container">
      <Link href="/" className="backLink">← Назад к потокам</Link>
      <h1 className="mt-1">{stream.template?.title || 'Поток'}</h1>
      <p className={styles.description}>
        {stream.template?.description || 'Нет описания'}
      </p>

      <p className={styles.rulesLinkRow}>
        <Link href={`/help/${HELP_SLUG_RULES}`} className={styles.rulesLink}>
          Правила марафона →
        </Link>
      </p>

      <div className={styles.details}>
        <p><strong>Длительность:</strong> {stream.template?.durationDays} дн.</p>
        <p><strong>Дата начала:</strong> {new Date(stream.startDate).toLocaleDateString()}</p>
        <p><strong>Статус:</strong> {stream.status}</p>
        <p><strong>Ментор:</strong> {stream.mentor?.name || 'Неизвестно'}</p>
        <p><strong>Участников:</strong> {stream.enrollmentsCount}</p>
      </div>

      {hasIntro && (
        <section className={styles.introSection}>
          <h2 className={styles.introTitle}>Материалы для подготовки</h2>
          {stream.intro?.text && (
            <div
              className={`${styles.introText} ${styles.richText}`}
              dangerouslySetInnerHTML={{ __html: stream.intro.text }}
            />
          )}
          {stream.intro && stream.intro.attachments.length > 0 && (
            <AttachmentPlayers attachments={stream.intro.attachments} />
          )}
        </section>
      )}

      {role === 'participant' && (
        <div className="mt-1-5">
          {stream.isEnrolled ? (
            <Button disabled variant="secondary">
              Вы записаны
            </Button>
          ) : (
            <div className={styles.enrollBox}>
              <div className={styles.enrollTitle}>Цель на этот поток</div>
              <div className={styles.goalOptions}>
                <label className={styles.goalOption}>
                  <input
                    type="radio"
                    name="goal"
                    value="lose"
                    checked={goal === 'lose'}
                    onChange={() => setGoal('lose')}
                  />
                  <span>Сброс веса</span>
                </label>
                <label className={styles.goalOption}>
                  <input
                    type="radio"
                    name="goal"
                    value="maintain"
                    checked={goal === 'maintain'}
                    onChange={() => setGoal('maintain')}
                  />
                  <span>Поддержание</span>
                </label>
                <label className={styles.goalOption}>
                  <input
                    type="radio"
                    name="goal"
                    value="gain"
                    checked={goal === 'gain'}
                    onChange={() => setGoal('gain')}
                  />
                  <span>Набор веса</span>
                </label>
              </div>
              <Button onClick={handleEnroll} variant="primary" loading={enrolling}>
                {enrolling ? 'Запись...' : 'Записаться в поток'}
              </Button>
            </div>
          )}
        </div>
      )}

      {role !== 'participant' && role !== null && (
        <p className="textMuted mt-1-5">
          Только участники могут записываться в потоки.
        </p>
      )}

      {role === null && (
        <p className="mt-1-5">
          <Link href="/login">Войдите</Link> или <Link href="/register">зарегистрируйтесь</Link>, чтобы записаться.
        </p>
      )}
    </main>
  );
}
