import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { Workout, WorkoutFavorite } from '@db/models';
import { uuidSchema } from '@/lib/validate';
import { NotFound } from '@/lib/errors';
import type { AuthenticatedRequest } from '@/types/auth';

async function ensureWorkoutExists(id: string): Promise<void> {
  const workout = await Workout.findByPk(id, { attributes: ['id'] });
  if (!workout) {
    throw new NotFound('Тренировка не найдена');
  }
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;

  await ensureWorkoutExists(id);

  await WorkoutFavorite.findOrCreate({
    where: { workoutId: id, userId: user.userId },
    defaults: { workoutId: id, userId: user.userId },
  });

  return success(res, { isFavorite: true });
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;

  await WorkoutFavorite.destroy({
    where: { workoutId: id, userId: user.userId },
  });

  return success(res, { isFavorite: false });
}

export default apiHandler({
  POST: withAuth(postHandler),
  DELETE: withAuth(deleteHandler),
});
