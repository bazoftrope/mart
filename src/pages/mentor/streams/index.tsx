import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import { ButtonLink } from '@/components/ui';
import styles from './MentorStreams.module.css';
import { apiFetch } from '@/lib/apiClient';
import StreamCard from '@/components/stream/StreamCard';
import cardStyles from '@/components/stream/StreamCard.module.css';

type StreamItem = {
  id: string;
  startDate: string;
  status: string;
  template: {
    id: string;
    title: string;
    description?: string;
    durationDays: number;
  } | null;
};

export default function MentorStreamsPage() {
  const router = useRouter();
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'mentor') {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        const res = await apiFetch('/api/streams/my', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить потоки');
        }
        setStreams(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1>Мои потоки</h1>
        <ButtonLink href="/mentor/streams/launch" variant="primary">
          Запустить поток
        </ButtonLink>
      </div>

      {loading && <p>Загрузка...</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !error && streams.length === 0 && (
        <p className={styles.emptyText}>Вы ещё не запустили ни одного потока.</p>
      )}
      {!loading && !error && streams.length > 0 && (
        <ul className={cardStyles.grid}>
          {streams.map((stream) => (
            <StreamCard
              key={stream.id}
              title={stream.template?.title || 'Поток без названия'}
              href={`/mentor/streams/${stream.id}`}
              startDate={stream.startDate}
              durationDays={stream.template?.durationDays}
              status={stream.status}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
