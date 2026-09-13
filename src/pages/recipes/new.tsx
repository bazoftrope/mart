import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import RecipeForm, {
  type RecipeFormValues,
} from '@/components/recipes/RecipeForm';
import type { Recipe } from '@/types/recipe';
import styles from './new.module.css';

export default function NewRecipePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    useAuthStore.getState().initAuth();
    if (!useAuthStore.getState().role) {
      router.replace('/login');
      return;
    }
    setChecking(false);
  }, [router]);

  async function handleSubmit(values: RecipeFormValues) {
    const recipe = await apiClient.post<Recipe>('/api/recipes', {
      title: values.title,
      description: values.description,
      ingredients: values.ingredients,
      steps: values.steps,
      attachments: values.attachments,
    });
    router.push(`/recipes/${recipe.id}`);
  }

  if (checking) {
    return (
      <main className="containerMd">
        <p>Загрузка...</p>
      </main>
    );
  }

  return (
    <main className="containerMd">
      <p>
        <Link href="/recipes" className="backLink">
          ← К книге рецептов
        </Link>
      </p>

      <h1 className="pageTitle">Новый рецепт</h1>
      <p className={styles.lead}>
        Рецепт появится в общей книге и будет доступен всем посетителям.
        Имя автора нигде не отображается.
      </p>

      <RecipeForm
        submitLabel="Добавить рецепт"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/recipes')}
      />
    </main>
  );
}
