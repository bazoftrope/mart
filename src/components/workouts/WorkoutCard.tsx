import ContentCard from '@/components/ui/ContentCard';
import type { Workout } from '@/types/workout';

type WorkoutCardProps = {
  workout: Workout;
  favoriteBusy?: boolean;
  onToggleFavorite: (workout: Workout) => void;
};

/**
 * Карточка тренировки в книге тренировок. Вид — общий с рецептами
 * (ContentCard): раньше тренировки были белой панелью с рамкой и лайком
 * в шапке, теперь книги выглядят одинаково.
 */
export default function WorkoutCard({
  workout,
  favoriteBusy = false,
  onToggleFavorite,
}: WorkoutCardProps) {
  return (
    <ContentCard
      title={workout.title}
      description={workout.description}
      href={`/workouts/${workout.id}`}
      editHref={workout.canEdit ? `/workouts/${workout.id}/edit` : undefined}
      lines={workout.exercises}
      linesLabel="Упражнения"
      linesPlural={['упражнение', 'упражнения', 'упражнений']}
      attachments={workout.attachments}
      isFavorite={workout.isFavorite}
      favoriteBusy={favoriteBusy}
      onToggleFavorite={() => onToggleFavorite(workout)}
    />
  );
}
