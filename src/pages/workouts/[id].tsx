import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import FavoriteButton from '@/components/recipes/FavoriteButton';
import AttachmentPlayers from '@/components/attachments/AttachmentPlayers';
import type { Workout } from '@/types/workout';
import styles from './[id].module.css';

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function WorkoutDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const role = useAuthStore((state) => state.role);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function toggleFavorite() {
    if (!workout) return;

    if (!role) {
      router.push('/login');
      return;
    }

    setActionError(null);
    setFavoriteBusy(true);
    try {
      const res = await apiFetch(`/api/workouts/${workout.id}/favorite`, {
        method: workout.isFavorite ? 'DELETE' : 'POST',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json.message || json.error || 'Не удалось обновить избранное'
        );
      }

      setWorkout({
        ...workout,
        isFavorite: Boolean(json.data?.isFavorite),
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Что-то пошло не так'
      );
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handleDelete() {
    if (!workout) return;
    if (!window.confirm('Удалить тренировку? Действие необратимо.')) return;

    setActionError(null);
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/workouts/${workout.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json.message || json.error || 'Не удалось удалить тренировку'
        );
      }

      router.push('/workouts');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Что-то пошло не так'
      );
      setDeleting(false);
    }
  }

  const exercises = workout ? splitLines(workout.exercises) : [];
  const execution = workout ? splitLines(workout.execution) : [];

  return (
    <main className="containerMd">
      <p>
        <Link href="/workouts" className="backLink">
          ← К книге тренировок
        </Link>
      </p>

      {loading && <div className="mutedBox">Загружаем тренировку...</div>}

      {!loading && error && <p className="error">{error}</p>}

      {workout && (
        <article className={styles.article}>
          <header className={styles.header}>
            <h1 className={styles.title}>{workout.title}</h1>

            <div className={styles.actions}>
              <FavoriteButton
                active={workout.isFavorite}
                busy={favoriteBusy}
                withLabel
                onToggle={toggleFavorite}
              />
              {workout.canEdit && (
                <>
                  <Link
                    href={`/workouts/${workout.id}/edit`}
                    className={styles.actionLink}
                  >
                    <Pencil size={16} />
                    Редактировать
                  </Link>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 size={16} />
                    {deleting ? 'Удаляем...' : 'Удалить'}
                  </button>
                </>
              )}
            </div>
          </header>

          {workout.description && (
            <p className={styles.description}>{workout.description}</p>
          )}

          {actionError && <p className="error">{actionError}</p>}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Упражнения</h2>
            {exercises.length > 0 ? (
              <ul className={styles.exercises}>
                {exercises.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="textMuted">Упражнения не указаны.</p>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Порядок выполнения</h2>
            {execution.length > 0 ? (
              <ol className={styles.steps}>
                {execution.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
            ) : (
              <p className="textMuted">Порядок выполнения не указан.</p>
            )}
          </section>

          {(workout.attachments?.length ?? 0) > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Материалы</h2>
              <AttachmentPlayers attachments={workout.attachments} />
            </section>
          )}

          <p className={styles.updated}>
            Обновлено {new Date(workout.updatedAt).toLocaleDateString('ru-RU')}
          </p>
        </article>
      )}
    </main>
  );
}
