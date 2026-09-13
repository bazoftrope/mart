import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth, withOptionalAuth } from '@/lib/middleware';
import { ContentAttachment, Recipe, RecipeFavorite } from '@db/models';
import { recipeSchema, uuidSchema } from '@/lib/validate';
import { Forbidden, NotFound } from '@/lib/errors';
import { canManageRecipe, toRecipeDto } from '@/lib/recipeUtils';
import { serializeContentAttachments } from '@/lib/contentAttachmentUtils';
import type { AuthenticatedRequest } from '@/types/auth';

function getCurrentUser(req: NextApiRequest) {
  return (req as Partial<AuthenticatedRequest>).user;
}

async function loadRecipe(id: string) {
  const recipe = await Recipe.findByPk(id);
  if (!recipe) {
    throw new NotFound('Рецепт не найден');
  }
  return recipe;
}

async function isFavoriteFor(recipeId: string, userId?: string): Promise<boolean> {
  if (!userId) return false;
  const row = await RecipeFavorite.findOne({
    where: { recipeId, userId },
    attributes: ['id'],
  });
  return Boolean(row);
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = getCurrentUser(req);
  const recipe = await loadRecipe(id);
  const attachments = serializeContentAttachments(
    await ContentAttachment.findAll({
      where: { ownerType: 'recipe', ownerId: recipe.id },
      order: [['position', 'ASC']],
    })
  );

  return success(
    res,
    toRecipeDto(recipe, {
      isFavorite: await isFavoriteFor(recipe.id, user?.userId),
      canEdit: canManageRecipe(recipe, user),
      attachments,
    })
  );
}

async function putHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;
  const recipe = await loadRecipe(id);

  if (!canManageRecipe(recipe, user)) {
    throw new Forbidden('Нет прав на редактирование рецепта');
  }

  const body = recipeSchema.parse(req.body);

  await recipe.update({
    title: body.title,
    description: body.description || null,
    ingredients: body.ingredients,
    steps: body.steps,
  });

  let attachments: ReturnType<typeof serializeContentAttachments> = [];
  if (body.attachments !== undefined) {
    await ContentAttachment.destroy({ where: { ownerType: 'recipe', ownerId: recipe.id } });
    if (body.attachments.length > 0) {
      const rows = await ContentAttachment.bulkCreate(
        body.attachments.map((a, idx) => ({
          ownerType: 'recipe' as const,
          ownerId: recipe.id,
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
        where: { ownerType: 'recipe', ownerId: recipe.id },
        order: [['position', 'ASC']],
      })
    );
  }

  return success(
    res,
    toRecipeDto(recipe, {
      isFavorite: await isFavoriteFor(recipe.id, user.userId),
      canEdit: true,
      attachments,
    })
  );
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;
  const recipe = await loadRecipe(id);

  if (!canManageRecipe(recipe, user)) {
    throw new Forbidden('Нет прав на удаление рецепта');
  }

  await RecipeFavorite.destroy({ where: { recipeId: recipe.id } });
  await ContentAttachment.destroy({ where: { ownerType: 'recipe', ownerId: recipe.id } });
  await recipe.destroy();

  return success(res, { id: recipe.id });
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  PUT: withAuth(putHandler),
  DELETE: withAuth(deleteHandler),
});
