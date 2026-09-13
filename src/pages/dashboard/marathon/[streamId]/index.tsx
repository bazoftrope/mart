import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import type { Goal } from '@db/models/StreamEnrollment';
import MarathonWindow, {
  type MarathonRating,
  type MarathonReport,
  type MarathonStream,
} from '@/components/marathon/MarathonWindow';
import styles from './MarathonCalendar.module.css';

type StreamCalendar = {
  stream: MarathonStream;
  currentDayNumber: number;
  measurementDays: number[];
  trainingDays: number[];
  restDays: number[];
  healthyEatingDays: number[];
  targetCalories: number | null;
  goal: Goal | null;
  rating: MarathonRating;
  reports: MarathonReport[];
};

function toNumber(value: unknown): number | null {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (typeof value !== 'string') return null;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

export default function MarathonCalendarPage() {
  const router = useRouter();
  const { streamId } = router.query;

  const [data, setData] = useState<StreamCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'participant') {
      router.push('/login');
      return;
    }
  }, [router]);

  useEffect(() => {
    if (!streamId) return;

    const sid = Array.isArray(streamId) ? streamId[0] : streamId;
    if (!sid) return;

    async function load() {
      try {
        const res = await apiFetch(`/api/streams/${sid}/calendar`, {
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить календарь');
        }
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [streamId]);

  if (loading) {
    return (
      <main className={styles.main}>
        <p>Загрузка...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={styles.main}>
        <p className={styles.error}>{error || 'Не удалось загрузить календарь'}</p>
      </main>
    );
  }

  const { stream, currentDayNumber, measurementDays, trainingDays, restDays, healthyEatingDays, targetCalories, goal, reports, rating } = data;
  const view = typeof router.query.view === 'string' ? router.query.view : undefined;
  const isMaterialsView = view === 'materials';

  if (stream.status === 'finished' && !isMaterialsView) {
    router.replace(`/dashboard/marathon/${stream.id}/results`);
    return null;
  }

  const requestedDay = toNumber(router.query.day);
  const activeDay =
    requestedDay !== null &&
    requestedDay >= 1 &&
    requestedDay <= stream.template.durationDays
      ? requestedDay
      : currentDayNumber > 0
        ? currentDayNumber
        : null;

  const handleDayChange = (day: number) => {
    const tab = router.query.tab;
    const tabQuery = typeof tab === 'string' ? `&tab=${tab}` : '';
    const viewQuery = isMaterialsView ? '&view=materials' : '';
    router.replace(
      `/dashboard/marathon/${stream.id}?day=${day}${tabQuery}${viewQuery}`,
      undefined,
      { shallow: true, scroll: false }
    );
  };

  return (
    <main className={styles.main}>
      {stream.status === 'finished' && isMaterialsView && (
        <nav className={styles.finishedTabs} aria-label="Завершённый марафон">
          <Link
            href={`/dashboard/marathon/${stream.id}/results`}
            className={styles.finishedTab}
          >
            Результаты
          </Link>
          <span className={`${styles.finishedTab} ${styles.finishedTabActive}`}>
            Материалы
          </span>
        </nav>
      )}
      <MarathonWindow
        stream={stream}
        currentDayNumber={currentDayNumber}
        targetCalories={targetCalories}
        goal={goal}
        rating={rating}
        reports={reports}
        measurementDays={measurementDays}
        trainingDays={trainingDays ?? []}
        restDays={restDays ?? []}
        healthyEatingDays={healthyEatingDays ?? []}
        activeDay={activeDay}
        onDayChange={handleDayChange}
      />
    </main>
  );
}