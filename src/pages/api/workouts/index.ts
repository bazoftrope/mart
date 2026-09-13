import type { NextApiRequest, NextApiResponse } from 'next';
import { Op, type WhereOptions } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth, withOptionalAuth } from '@/lib/middleware';
import { ContentAttachment, Workout, WorkoutFavorite } from '@db/models';
import { workoutSchema } from '@/lib/validate';
import { Unauthorized } from '@/lib/errors';
import { canManageWorkout, toWorkoutDto } from '@/lib/workoutUtils';
import { serializeContentAttachments } from '@/lib/contentAttachmentUtils';
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

async function attachmentsMapForWorkouts(workoutIds: string[]) {
  if (workoutIds.length === 0) return new Map<string, ReturnType<typeof serializeContentAttachments>>();
  const rows = await ContentAttachment.findAll({
    where: { ownerType: 'workout', ownerId: workoutIds },
    order: [['position', 'ASC']],
  });
  const map = new Map<string, typeof rows>();
  for (const row of rows) {
    const arr = map.get(row.ownerId) ?? [];
    arr.push(row);
    map.set(row.ownerId, arr);
  }
  const serialized = new Map<string, ReturnType<typeof serializeContentAttachments>>();
  Array.from(map.entries()).forEach(([k, v]) => {
    serialized.set(k, serializeContentAttachments(v));
  });
  return serialized;
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

  const attachmentsMap = await attachmentsMapForWorkouts(rows.map((r) => r.id));

  const items = rows.map((workout) =>
    toWorkoutDto(workout, {
      isFavorite: favoriteSet.has(workout.id),
      canEdit: canManageWorkout(workout, user),
      attachments: attachmentsMap.get(workout.id) ?? [],
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

  let attachments: ReturnType<typeof serializeContentAttachments> = [];
  if (body.attachments && body.attachments.length > 0) {
    const rows = await ContentAttachment.bulkCreate(
      body.attachments.map((a, idx) => ({
        ownerType: 'workout' as const,
        ownerId: workout.id,
        kind: a.kind,
        url: a.url,
        fileName: a.fileName ?? null,
        mimeType: a.mimeType ?? null,
        sizeBytes: a.sizeBytes ?? null,
        position: a.position ?? idx,
        pairId: a.pairId ?? null,
        description: a.description ?? null,
      }))
    );
    attachments = serializeContentAttachments(rows);
  }

  return success(
    res,
    toWorkoutDto(workout, { isFavorite: false, canEdit: true, attachments }),
    201
  );
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  POST: withAuth(postHandler),
});
