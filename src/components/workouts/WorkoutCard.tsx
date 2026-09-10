import Link from 'next/link';
import { Pencil } from 'lucide-react';
import FavoriteButton from '@/components/recipes/FavoriteButton';
import type { Workout } from '@/types/workout';
import styles from './WorkoutCard.module.css';

type WorkoutCardProps = {
  workout: Workout;
  favoriteBusy?: boolean;
  onToggleFavorite: (workout: Workout) => void;
};

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function pluralizeExercises(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'упражнение';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'упражнения';
  }
  return 'упражнений';
}

const EXERCISE_PREVIEW_LIMIT = 3;

export default function WorkoutCard({
  workout,
  favoriteBusy = false,
  onToggleFavorite,
}: WorkoutCardProps) {
  const exercises = splitLines(workout.exercises);
  const preview = exercises.slice(0, EXERCISE_PREVIEW_LIMIT);
  const restCount = exercises.length - preview.length;

  return (
    <li className={styles.card}>
      <header className={styles.header}>
        <Link href={`/workouts/${workout.id}`} className={styles.titleLink}>
          <h3 className={styles.title}>{workout.title}</h3>
        </Link>
        <FavoriteButton
          active={workout.isFavorite}
          busy={favoriteBusy}
          onToggle={() => onToggleFavorite(workout)}
        />
      </header>

      {workout.description && (
        <p className={styles.description}>{workout.description}</p>
      )}

      {preview.length > 0 && (
        <div className={styles.exercisesBlock}>
          <span className={styles.label}>Упражнения</span>
          <ul className={styles.exercises}>
            {preview.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
          {restCount > 0 && (
            <p className={styles.exercisesMore}>
              и ещё {restCount} {pluralizeExercises(restCount)}
            </p>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <Link href={`/workouts/${workout.id}`} className={styles.openLink}>
          Смотреть тренировку
        </Link>
        {workout.canEdit && (
          <Link
            href={`/workouts/${workout.id}/edit`}
            className={styles.editLink}
          >
            <Pencil size={14} />
            Изменить
          </Link>
        )}
      </footer>
    </li>
  );
}
