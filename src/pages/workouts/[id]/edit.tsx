import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient, apiFetch } from '@/lib/apiClient';
import WorkoutForm, {
  type WorkoutFormValues,
} from '@/components/workouts/WorkoutForm';
import type { Workout } from '@/types/workout';
import styles from './edit.module.css';

export default function EditWorkoutPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const role = useAuthStore((state) => state.role);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/workouts/${id}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json.message || json.error || 'Не удалось загрузить тренировку'
        );
      }

      setWorkout(json.data as Workout);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(values: WorkoutFormValues) {
    if (!workout) return;

    await apiClient.put<Workout>(`/api/workouts/${workout.id}`, {
      title: values.title,
      description: values.description,
      exercises: values.exercises,
      execution: values.execution,
    });

    router.push(`/workouts/${workout.id}`);
  }

  return (
    <main className="containerMd">
      <p>
        <Link
          href={workout ? `/workouts/${workout.id}` : '/workouts'}
          className="backLink"
        >
          ← {workout ? 'К тренировке' : 'К книге тренировок'}
        </Link>
      </p>

      <h1 className="pageTitle">Редактирование тренировки</h1>

      {loading && <div className="mutedBox">Загружаем тренировку...</div>}
      {!loading && error && <p className="error">{error}</p>}

      {workout && !workout.canEdit && (
        <div className={styles.notice}>
          <p>
            Редактировать тренировку может только её автор или администратор.
          </p>
          {!role && (
            <Link href="/login" className="btn btnPrimary">
              Войти
            </Link>
          )}
        </div>
      )}

      {workout && workout.canEdit && (
        <WorkoutForm
          initialValues={{
            title: workout.title,
            description: workout.description ?? '',
            exercises: workout.exercises,
            execution: workout.execution,
          }}
          submitLabel="Сохранить изменения"
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/workouts/${workout.id}`)}
        />
      )}
    </main>
  );
}
