import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { Recipe, RecipeFavorite } from '@db/models';
import { uuidSchema } from '@/lib/validate';
import { NotFound } from '@/lib/errors';
import type { AuthenticatedRequest } from '@/types/auth';

async function ensureRecipeExists(id: string): Promise<void> {
  const recipe = await Recipe.findByPk(id, { attributes: ['id'] });
  if (!recipe) {
    throw new NotFound('Рецепт не найден');
  }
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;

  await ensureRecipeExists(id);

  await RecipeFavorite.findOrCreate({
    where: { recipeId: id, userId: user.userId },
    defaults: { recipeId: id, userId: user.userId },
  });

  return success(res, { isFavorite: true });
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);
  const user = (req as AuthenticatedRequest).user;

  await RecipeFavorite.destroy({
    where: { recipeId: id, userId: user.userId },
  });

  return success(res, { isFavorite: false });
}

export default apiHandler({
  POST: withAuth(postHandler),
  DELETE: withAuth(deleteHandler),
});
