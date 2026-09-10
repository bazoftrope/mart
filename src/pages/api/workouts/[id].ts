import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth, withOptionalAuth } from '@/lib/middleware';
import { Workout, WorkoutFavorite } from '@db/models';
import { workoutSchema, uuidSchema } from '@/lib/validate';
import { Forbidden, NotFound } from '@/lib/errors';
import { canManageWorkout, toWorkoutDto } from '@/lib/workoutUtils';
import type { AuthenticatedRequest } from '@/types/auth';

function getCurrentUser(req: NextApiRequest) {
  return (req as Partial<AuthenticatedRequest>).user;
}

async function loadWorkout(id: string) {
  const workout = await Workout.findByPk(id);
  if (!workout) {
    throw new NotFound('Тренировка не найдена');
  }
  return workout;
}

async function isFavoriteFor(workoutId: string, userId?: string): Promise<boolean> {
  if (!userId) return false;
  const row = await WorkoutFavorite.findOne({
    where: { workoutId, userId },
    attributes: ['id'],
  });
  return Boolean(row);
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = getCurrentUser(req);
  const workout = await loadWorkout(id);

  return success(
    res,
    toWorkoutDto(workout, {
      isFavorite: await isFavoriteFor(workout.id, user?.userId),
      canEdit: canManageWorkout(workout, user),
    })
  );
}

async function putHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;
  const workout = await loadWorkout(id);

  if (!canManageWorkout(workout, user)) {
    throw new Forbidden('Нет прав на редактирование тренировки');
  }

  const body = workoutSchema.parse(req.body);

  await workout.update({
    title: body.title,
    description: body.description || null,
    exercises: body.exercises,
    execution: body.execution,
  });

  return success(
    res,
    toWorkoutDto(workout, {
      isFavorite: await isFavoriteFor(workout.id, user.userId),
      canEdit: true,
    })
  );
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;
  const workout = await loadWorkout(id);

  if (!canManageWorkout(workout, user)) {
    throw new Forbidden('Нет прав на удаление тренировки');
  }

  await WorkoutFavorite.destroy({ where: { workoutId: workout.id } });
  await workout.destroy();

  return success(res, { id: workout.id });
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  PUT: withAuth(putHandler),
  DELETE: withAuth(deleteHandler),
});
