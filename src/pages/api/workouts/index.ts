import type { NextApiRequest, NextApiResponse } from 'next';
import { Op, type WhereOptions } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth, withOptionalAuth } from '@/lib/middleware';
import { Workout, WorkoutFavorite } from '@db/models';
import { workoutSchema } from '@/lib/validate';
import { Unauthorized } from '@/lib/errors';
import { canManageWorkout, toWorkoutDto } from '@/lib/workoutUtils';
import type { AuthenticatedRequest } from '@/types/auth';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;

function getCurrentUser(req: NextApiRequest) {
  return (req as Partial<AuthenticatedRequest>).user;
}

async function favoriteIdsForUser(userId: string): Promise<string[]> {
  const rows = await WorkoutFavorite.findAll({
    where: { userId },
    attributes: ['workoutId'],
  });
  return rows.map((row) => row.workoutId);
}

/**
 * Публичный список тренировок: доступен всем, в том числе гостям.
 * Авторизованному пользователю дополнительно отдаём избранное
 * и признак права на редактирование.
 */
async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = getCurrentUser(req);

  const rawSearch = typeof req.query.search === 'string' ? req.query.search : '';
  const search = rawSearch.trim().slice(0, MAX_SEARCH_LENGTH);
  const favoritesOnly = req.query.favorites === '1';

  if (favoritesOnly && !user) {
    throw new Unauthorized('Войдите, чтобы открыть избранное');
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    )
  );

  const where: WhereOptions = {};
  if (search) {
    const like = `%${search}%`;
    Object.assign(where, {
      [Op.or]: [
        { title: { [Op.iLike]: like } },
        { description: { [Op.iLike]: like } },
        { exercises: { [Op.iLike]: like } },
        { execution: { [Op.iLike]: like } },
      ],
    });
  }

  const favoriteIds = user ? await favoriteIdsForUser(user.userId) : [];
  const favoriteSet = new Set(favoriteIds);

  if (favoritesOnly) {
    Object.assign(where, { id: { [Op.in]: favoriteIds } });
  }

  const { rows, count } = await Workout.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  const items = rows.map((workout) =>
    toWorkoutDto(workout, {
      isFavorite: favoriteSet.has(workout.id),
      canEdit: canManageWorkout(workout, user),
    })
  );

  return success(res, {
    items,
    total: count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  });
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as AuthenticatedRequest).user;
  const body = workoutSchema.parse(req.body);

  const workout = await Workout.create({
    title: body.title,
    description: body.description || null,
    exercises: body.exercises,
    execution: body.execution,
    createdBy: user.userId,
  });

  return success(
    res,
    toWorkoutDto(workout, { isFavorite: false, canEdit: true }),
    201
  );
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  POST: withAuth(postHandler),
});
