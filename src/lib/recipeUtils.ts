import type { Recipe } from '@db/models/Recipe';
import type { TokenPayload } from '@/types/auth';

export type RecipeDto = {
  id: string;
  title: string;
  description: string | null;
  ingredients: string;
  steps: string;
  createdAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
  canEdit: boolean;
};

/**
 * Рецепты — общая книга, поэтому автор нигде не показывается.
 * Права на изменение нужны только для проверки: автор или админ.
 * Гостю и остальным участникам возвращаем `canEdit: false`.
 */
export function canManageRecipe(
  recipe: Recipe,
  user?: TokenPayload
): boolean {
  if (!user) return false;
  return user.role === 'admin' || recipe.createdBy === user.userId;
}

export function toRecipeDto(
  recipe: Recipe,
  options: { isFavorite: boolean; canEdit: boolean }
): RecipeDto {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    isFavorite: options.isFavorite,
    canEdit: options.canEdit,
  };
}
