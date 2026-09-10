import Link from 'next/link';
import { Pencil } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import type { Recipe } from '@/types/recipe';
import styles from './RecipeCard.module.css';

type RecipeCardProps = {
  recipe: Recipe;
  favoriteBusy?: boolean;
  onToggleFavorite: (recipe: Recipe) => void;
};

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function pluralizeIngredients(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ингредиент';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'ингредиента';
  }
  return 'ингредиентов';
}

const INGREDIENT_PREVIEW_LIMIT = 3;

export default function RecipeCard({
  recipe,
  favoriteBusy = false,
  onToggleFavorite,
}: RecipeCardProps) {
  const ingredients = splitLines(recipe.ingredients);
  const preview = ingredients.slice(0, INGREDIENT_PREVIEW_LIMIT);
  const restCount = ingredients.length - preview.length;

  return (
    <li className={styles.card}>
      <header className={styles.header}>
        <Link href={`/recipes/${recipe.id}`} className={styles.titleLink}>
          <h3 className={styles.title}>{recipe.title}</h3>
        </Link>
        <FavoriteButton
          active={recipe.isFavorite}
          busy={favoriteBusy}
          onToggle={() => onToggleFavorite(recipe)}
        />
      </header>

      {recipe.description && (
        <p className={styles.description}>{recipe.description}</p>
      )}

      {preview.length > 0 && (
        <div className={styles.ingredientsBlock}>
          <span className={styles.label}>Ингредиенты</span>
          <ul className={styles.ingredients}>
            {preview.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
          {restCount > 0 && (
            <p className={styles.ingredientsMore}>
              и ещё {restCount} {pluralizeIngredients(restCount)}
            </p>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <Link href={`/recipes/${recipe.id}`} className={styles.openLink}>
          Смотреть рецепт
        </Link>
        {recipe.canEdit && (
          <Link href={`/recipes/${recipe.id}/edit`} className={styles.editLink}>
            <Pencil size={14} />
            Изменить
          </Link>
        )}
      </footer>
    </li>
  );
}
