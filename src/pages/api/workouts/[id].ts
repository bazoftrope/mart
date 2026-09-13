import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth, withOptionalAuth } from '@/lib/middleware';
import { ContentAttachment, Workout, WorkoutFavorite } from '@db/models';
import { workoutSchema, uuidSchema } from '@/lib/validate';
import { Forbidden, NotFound } from '@/lib/errors';
import { canManageWorkout, toWorkoutDto } from '@/lib/workoutUtils';
import { serializeContentAttachments } from '@/lib/contentAttachmentUtils';
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
  const attachments = serializeContentAttachments(
    await ContentAttachment.findAll({
      where: { ownerType: 'workout', ownerId: workout.id },
      order: [['position', 'ASC']],
    })
  );

  return success(
    res,
    toWorkoutDto(workout, {
      isFavorite: await isFavoriteFor(workout.id, user?.userId),
      canEdit: canManageWorkout(workout, user),
      attachments,
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

  let attachments: ReturnType<typeof serializeContentAttachments> = [];
  if (body.attachments !== undefined) {
    await ContentAttachment.destroy({ where: { ownerType: 'workout', ownerId: workout.id } });
    if (body.attachments.length > 0) {
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
  } else {
    attachments = serializeContentAttachments(
      await ContentAttachment.findAll({
        where: { ownerType: 'workout', ownerId: workout.id },
        order: [['position', 'ASC']],
      })
    );
  }

  return success(
    res,
    toWorkoutDto(workout, {
      isFavorite: await isFavoriteFor(workout.id, user.userId),
      canEdit: true,
      attachments,
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
  await ContentAttachment.destroy({ where: { ownerType: 'workout', ownerId: workout.id } });
  await workout.destroy();

  return success(res, { id: workout.id });
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  PUT: withAuth(putHandler),
  DELETE: withAuth(deleteHandler),
});
