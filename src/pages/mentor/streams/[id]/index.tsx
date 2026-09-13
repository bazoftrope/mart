import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import ParticipantCard, {
  type Participant,
  type ParticipantRating,
} from '@/components/mentor/ParticipantCard';
import MentorStreamChat from '@/components/Chat/MentorStreamChat';
import styles from './MentorStreamDetails.module.css';
import { apiFetch } from '@/lib/apiClient';

type Enrollment = {
  id: string;
  enrolledAt: string;
  participant: Participant | null;
  rating: ParticipantRating | null;
};

type StreamDetails = {
  id: string;
  startDate: string;
  status: string;
  createdAt: string;
  enrollmentsCount: number;
  template: {
    id: string;
    title: string;
    description?: string;
    durationDays: number;
  } | null;
};

export default function MentorStreamDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [stream, setStream] = useState<StreamDetails | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialParticipantId = typeof router.query.participantId === 'string' ? router.query.participantId : undefined;

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'mentor') {
      router.push('/login');
      return;
    }
    if (!id) return;

    async function load() {
      try {
        const [streamRes, enrollmentsRes] = await Promise.all([
          apiFetch(`/api/streams/${id}`, { credentials: 'include' }),
          apiFetch(`/api/streams/${id}/enrollments`, { credentials: 'include' }),
        ]);

        const streamJson = await streamRes.json().catch(() => ({}));
        const enrollmentsJson = await enrollmentsRes.json().catch(() => ({}));

        if (!streamRes.ok) {
          throw new Error(streamJson.message || streamJson.error || 'Не удалось загрузить поток');
        }
        if (!enrollmentsRes.ok) {
          throw new Error(enrollmentsJson.message || enrollmentsJson.error || 'Не удалось загрузить записи');
        }

        setStream(streamJson.data);
        setEnrollments(enrollmentsJson.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, router]);

  if (loading) return <main className={styles.main}><p>Загрузка...</p></main>;
  if (error) return <main className={styles.main}><p className={styles.error}>{error}</p></main>;
  if (!stream) return <main className={styles.main}><p>Поток не найден</p></main>;

  return (
    <main className={styles.main}>
      <Link href="/mentor/streams" className={styles.backLink}>← Назад к моим потокам</Link>
      <h1 className={styles.title}>{stream.template?.title || 'Поток'}</h1>
      <p className={styles.description}>
        {stream.template?.description || 'Нет описания'}
      </p>

      <div className={styles.infoBlock}>
        <p><strong>Длительность:</strong> {stream.template?.durationDays} дн.</p>
        <p><strong>Дата начала:</strong> {new Date(stream.startDate).toLocaleDateString()}</p>
        <p><strong>Статус:</strong> {stream.status}</p>
        <p><strong>Всего участников:</strong> {stream.enrollmentsCount}</p>
      </div>

      <div id="chat">
        <MentorStreamChat streamId={stream.id} enrollments={enrollments} streamStatus={stream.status} initialParticipantId={initialParticipantId} />
      </div>

      <section className={styles.section}>
        <h2>Участники</h2>
        {enrollments.length === 0 && <p>Участников пока нет.</p>}
        {enrollments.length > 0 && (
          <ul className={styles.list}>
            {enrollments.map((enrollment) => (
              <ParticipantCard
                key={enrollment.id}
                streamId={id as string}
                enrolledAt={enrollment.enrolledAt}
                participant={enrollment.participant}
                rating={enrollment.rating}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
