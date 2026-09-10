import type { Workout } from '@db/models/Workout';
import type { TokenPayload } from '@/types/auth';

export type WorkoutDto = {
  id: string;
  title: string;
  description: string | null;
  exercises: string;
  execution: string;
  createdAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
  canEdit: boolean;
};

/**
 * Тренировки — общая книга, поэтому автор нигде не показывается.
 * Права на изменение нужны только для проверки: автор или админ.
 * Гостю и остальным участникам возвращаем `canEdit: false`.
 */
export function canManageWorkout(
  workout: Workout,
  user?: TokenPayload
): boolean {
  if (!user) return false;
  return user.role === 'admin' || workout.createdBy === user.userId;
}

export function toWorkoutDto(
  workout: Workout,
  options: { isFavorite: boolean; canEdit: boolean }
): WorkoutDto {
  return {
    id: workout.id,
    title: workout.title,
    description: workout.description,
    exercises: workout.exercises,
    execution: workout.execution,
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
    isFavorite: options.isFavorite,
    canEdit: options.canEdit,
  };
}
