import { Clock } from 'lucide-react';
import ContentCard from '@/components/ui/ContentCard';
import type { Recipe } from '@/types/recipe';

type RecipeCardProps = {
  recipe: Recipe;
  favoriteBusy?: boolean;
  onToggleFavorite: (recipe: Recipe) => void;
  /**
   * Бейдж категории и времени приготовления. В модели `Recipe` таких полей
   * пока нет, поэтому по умолчанию пропсы не передаются и бейджи не рендерятся.
   */
  cookTime?: string;
  category?: string;
};

/**
 * Карточка рецепта в книге рецептов. Вид — общий с тренировками (ContentCard),
 * здесь остаётся только привязка данных рецепта к общему компоненту.
 */
export default function RecipeCard({
  recipe,
  favoriteBusy = false,
  onToggleFavorite,
  cookTime,
  category,
}: RecipeCardProps) {
  return (
    <ContentCard
      title={recipe.title}
      description={recipe.description}
      href={`/recipes/${recipe.id}`}
      editHref={recipe.canEdit ? `/recipes/${recipe.id}/edit` : undefined}
      lines={recipe.ingredients}
      linesLabel="Ингредиенты"
      linesPlural={['ингредиент', 'ингредиента', 'ингредиентов']}
      attachments={recipe.attachments}
      isFavorite={recipe.isFavorite}
      favoriteBusy={favoriteBusy}
      onToggleFavorite={() => onToggleFavorite(recipe)}
      category={category}
      cookTime={cookTime}
      timeIcon={<Clock size={13} aria-hidden="true" />}
    />
  );
}
