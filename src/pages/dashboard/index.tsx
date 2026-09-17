import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import { ButtonLink } from '@/components/ui';
import { apiFetch } from '@/lib/apiClient';
import StreamCard from '@/components/stream/StreamCard';
import cardStyles from '@/components/stream/StreamCard.module.css';

type Enrollment = {
  id: string;
  enrolledAt: string;
  stream: {
    id: string;
    startDate: string;
    status: string;
    template: {
      id: string;
      title: string;
      description?: string;
      durationDays: number;
    } | null;
    mentor: {
      id: string;
      name: string;
      email: string;
    } | null;
  } | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();
    const currentRole = useAuthStore.getState().role;
    if (currentRole !== 'participant') {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        const meRes = await apiFetch('/api/users/me', { credentials: 'include' });
        const meJson = await meRes.json().catch(() => ({}));
        if (!meRes.ok) {
          throw new Error(meJson.message || meJson.error || 'Не удалось загрузить профиль');
        }
        if (!meJson.data?.profileCompleted) {
          router.replace('/onboarding');
          return;
        }

        const res = await apiFetch('/api/streams/my', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить записи');
        }
        setEnrollments(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  return (
    <main className="container">
      <h1 className="pageTitle">Мои марафоны</h1>

      {loading && <p>Загрузка...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && enrollments.length === 0 && (
        <div className="mt-1">
          <p>Вы ещё не записаны ни на один марафон.</p>
          <ButtonLink href="/" variant="primary" className="mt-1">
            Посмотреть открытые потоки
          </ButtonLink>
        </div>
      )}
      {!loading && !error && enrollments.length > 0 && (
        <ul className={cardStyles.grid}>
          {enrollments.map((enrollment) => {
            const streamId = enrollment.stream?.id;
            const isFinished = enrollment.stream?.status === 'finished';
            return (
              <StreamCard
                key={enrollment.id}
                title={enrollment.stream?.template?.title || 'Неизвестный марафон'}
                href={
                  streamId
                    ? isFinished
                      ? `/dashboard/marathon/${streamId}/results`
                      : `/dashboard/marathon/${streamId}`
                    : undefined
                }
                resultsHref={
                  streamId && isFinished
                    ? `/dashboard/marathon/${streamId}/results`
                    : undefined
                }
                materialsHref={
                  streamId && isFinished
                    ? `/dashboard/marathon/${streamId}?view=materials`
                    : undefined
                }
                description={enrollment.stream?.template?.description || 'Нет описания'}
                mentorName={enrollment.stream?.mentor?.name || 'Неизвестно'}
                startDate={enrollment.stream?.startDate}
                status={enrollment.stream?.status}
                enrolledAt={enrollment.enrolledAt}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}
