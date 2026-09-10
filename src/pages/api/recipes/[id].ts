import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth, withOptionalAuth } from '@/lib/middleware';
import { Recipe, RecipeFavorite } from '@db/models';
import { recipeSchema, uuidSchema } from '@/lib/validate';
import { Forbidden, NotFound } from '@/lib/errors';
import { canManageRecipe, toRecipeDto } from '@/lib/recipeUtils';
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

  return success(
    res,
    toRecipeDto(recipe, {
      isFavorite: await isFavoriteFor(recipe.id, user?.userId),
      canEdit: canManageRecipe(recipe, user),
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

  return success(
    res,
    toRecipeDto(recipe, {
      isFavorite: await isFavoriteFor(recipe.id, user.userId),
      canEdit: true,
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
  await recipe.destroy();

  return success(res, { id: recipe.id });
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  PUT: withAuth(putHandler),
  DELETE: withAuth(deleteHandler),
});
