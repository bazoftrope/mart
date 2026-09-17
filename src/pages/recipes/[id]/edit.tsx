import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient, apiFetch } from '@/lib/apiClient';
import { ButtonLink } from '@/components/ui';
import RecipeForm, {
  type RecipeFormValues,
} from '@/components/recipes/RecipeForm';
import type { Recipe } from '@/types/recipe';
import styles from './edit.module.css';

export default function EditRecipePage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const role = useAuthStore((state) => state.role);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(values: RecipeFormValues) {
    if (!recipe) return;

    await apiClient.put<Recipe>(`/api/recipes/${recipe.id}`, {
      title: values.title,
      description: values.description,
      ingredients: values.ingredients,
      steps: values.steps,
      attachments: values.attachments,
    });

    router.push(`/recipes/${recipe.id}`);
  }

  return (
    <main className="containerMd">
      <p>
        <Link
          href={recipe ? `/recipes/${recipe.id}` : '/recipes'}
          className="backLink"
        >
          ← {recipe ? 'К рецепту' : 'К книге рецептов'}
        </Link>
      </p>

      <h1 className="pageTitle">Редактирование рецепта</h1>

      {loading && <div className="mutedBox">Загружаем рецепт...</div>}
      {!loading && error && <p className="error">{error}</p>}

      {recipe && !recipe.canEdit && (
        <div className={styles.notice}>
          <p>
            Редактировать рецепт может только его автор или администратор.
          </p>
          {!role && (
            <ButtonLink href="/login" variant="primary">
              Войти
            </ButtonLink>
          )}
        </div>
      )}

      {recipe && recipe.canEdit && (
        <RecipeForm
          initialValues={{
            title: recipe.title,
            description: recipe.description ?? '',
            ingredients: recipe.ingredients,
            steps: recipe.steps,
            attachments: recipe.attachments ?? [],
          }}
          submitLabel="Сохранить изменения"
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/recipes/${recipe.id}`)}
        />
      )}
    </main>
  );
}
