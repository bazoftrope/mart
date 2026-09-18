import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AttachmentPlayers from '@/components/attachments/AttachmentPlayers';
import type { Recipe } from '@/types/recipe';
import styles from './[id].module.css';

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function RecipeDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const role = useAuthStore((state) => state.role);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/recipes/${id}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json.message || json.error || 'Не удалось загрузить рецепт'
        );
      }

      setRecipe(json.data as Recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFavorite() {
    if (!recipe) return;

    if (!role) {
      router.push('/login');
      return;
    }

    setActionError(null);
    setFavoriteBusy(true);
    try {
      const res = await apiFetch(`/api/recipes/${recipe.id}/favorite`, {
        method: recipe.isFavorite ? 'DELETE' : 'POST',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json.message || json.error || 'Не удалось обновить избранное'
        );
      }

      setRecipe({
        ...recipe,
        isFavorite: Boolean(json.data?.isFavorite),
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Что-то пошло не так'
      );
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handleDelete() {
    if (!recipe) return;
    if (!window.confirm('Удалить рецепт? Действие необратимо.')) return;

    setActionError(null);
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/recipes/${recipe.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json.message || json.error || 'Не удалось удалить рецепт'
        );
      }

      router.push('/recipes');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Что-то пошло не так'
      );
      setDeleting(false);
    }
  }

  const ingredients = recipe ? splitLines(recipe.ingredients) : [];
  const steps = recipe ? splitLines(recipe.steps) : [];

  return (
    <main className="containerMd">
      <p>
        <Link href="/recipes" className="backLink">
          ← К книге рецептов
        </Link>
      </p>

      {loading && <div className="mutedBox">Загружаем рецепт...</div>}

      {!loading && error && <p className="error">{error}</p>}

      {recipe && (
        <article className={styles.article}>
          <header className={styles.header}>
            <h1 className={styles.title}>{recipe.title}</h1>

            <div className={styles.actions}>
              <FavoriteButton
                active={recipe.isFavorite}
                busy={favoriteBusy}
                withLabel
                onToggle={toggleFavorite}
              />
              {recipe.canEdit && (
                <>
                  <Link
                    href={`/recipes/${recipe.id}/edit`}
                    className={styles.actionLink}
                  >
                    <Pencil size={16} />
                    Редактировать
                  </Link>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 size={16} />
                    {deleting ? 'Удаляем...' : 'Удалить'}
                  </button>
                </>
              )}
            </div>
          </header>

          {recipe.description && (
            <p className={styles.description}>{recipe.description}</p>
          )}

          {actionError && <p className="error">{actionError}</p>}

          <div className={styles.blocks}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Ингредиенты</h2>
              {ingredients.length > 0 ? (
                <ul className={styles.ingredients}>
                  {ingredients.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="textMuted">Ингредиенты не указаны.</p>
              )}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Приготовление</h2>
              {steps.length > 0 ? (
                <ol className={styles.steps}>
                  {steps.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ol>
              ) : (
                <p className="textMuted">Шаги приготовления не указаны.</p>
              )}
            </section>
          </div>

          {(recipe.attachments?.length ?? 0) > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Материалы</h2>
              <AttachmentPlayers attachments={recipe.attachments} />
            </section>
          )}

          <p className={styles.updated}>
            Обновлено {new Date(recipe.updatedAt).toLocaleDateString('ru-RU')}
          </p>
        </article>
      )}
    </main>
  );
}
