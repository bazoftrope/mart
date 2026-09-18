import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Search } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui';
import RecipeCard from '@/components/recipes/RecipeCard';
import cardStyles from '@/components/ui/ContentCard.module.css';
import type { Recipe, RecipeListResponse } from '@/types/recipe';
import styles from './index.module.css';

type Tab = 'all' | 'favorites';

const PAGE_SIZE = 12;

function pluralizeRecipes(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} рецепт`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} рецепта`;
  }
  return `${count} рецептов`;
}

export default function RecipesPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  // Поиск с небольшой задержкой, чтобы не дёргать API на каждый символ.
  useEffect(() => {
    const trimmed = searchInput.trim();
    const timer = setTimeout(() => {
      setSearch(trimmed);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (tab === 'favorites' && !role) {
      setRecipes([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (tab === 'favorites') params.set('favorites', '1');
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));

        const res = await apiFetch(`/api/recipes?${params.toString()}`);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            json.message || json.error || 'Не удалось загрузить рецепты'
          );
        }

        const data = json.data as RecipeListResponse;
        if (cancelled) return;

        setRecipes(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Что-то пошло не так');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [search, tab, page, role]);

  const toggleFavorite = useCallback(
    async (recipe: Recipe) => {
      if (!role) {
        router.push('/login');
        return;
      }

      setFavoriteError(null);
      setFavoriteBusyId(recipe.id);
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

        const isFavorite = Boolean(json.data?.isFavorite);

        setRecipes((prev) => {
          if (tab === 'favorites' && !isFavorite) {
            return prev.filter((item) => item.id !== recipe.id);
          }
          return prev.map((item) =>
            item.id === recipe.id ? { ...item, isFavorite } : item
          );
        });

        if (tab === 'favorites' && !isFavorite) {
          setTotal((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        setFavoriteError(
          err instanceof Error ? err.message : 'Что-то пошло не так'
        );
      } finally {
        setFavoriteBusyId(null);
      }
    },
    [role, router, tab]
  );

  function switchTab(nextTab: Tab) {
    if (nextTab === tab) return;
    setTab(nextTab);
    setPage(1);
  }

  const hasFilters = Boolean(search) || tab === 'favorites';

  return (
    <main className="container">
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className="pageTitle">Книга рецептов</h1>
          <p className={styles.lead}>
            Открытая коллекция рецептов: смотрите, ищите и сохраняйте лучшее
            в избранное. Доступна всем — даже без регистрации.
          </p>
        </div>
        {role ? (
          <ButtonLink href="/recipes/new" variant="primary">
            Добавить рецепт
          </ButtonLink>
        ) : (
          <ButtonLink href="/login" variant="primary">
            Войти, чтобы добавить
          </ButtonLink>
        )}
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск по названию, ингредиентам, приготовлению..."
            aria-label="Поиск рецептов"
          />
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Разделы книги">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={tab === 'all' ? styles.tabActive : styles.tab}
            onClick={() => switchTab('all')}
          >
            Все рецепты
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'favorites'}
            className={tab === 'favorites' ? styles.tabActive : styles.tab}
            onClick={() => switchTab('favorites')}
          >
            Избранное
          </button>
        </div>
      </div>

      {favoriteError && <p className="error">{favoriteError}</p>}

      {tab === 'favorites' && !role ? (
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>
            Избранное доступно авторизованным пользователям.
          </p>
          <p className={styles.noticeHint}>
            Войдите или зарегистрируйтесь, чтобы сохранять рецепты и
            возвращаться к ним с любого устройства.
          </p>
          <div className={styles.noticeActions}>
            <ButtonLink href="/login" variant="primary">
              Войти
            </ButtonLink>
            <ButtonLink href="/register" variant="outline">
              Регистрация
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          {error && <p className="error">{error}</p>}

          {!error && loading && recipes.length === 0 && (
            <div className="mutedBox">Загружаем рецепты...</div>
          )}

          {!error && !loading && recipes.length === 0 && (
            <div className={styles.empty}>
              {tab === 'favorites' ? (
                <p>
                  В избранном пока пусто. Отмечайте рецепты сердечком, чтобы
                  вернуться к ним позже.
                </p>
              ) : hasFilters ? (
                <p>
                  По вашему запросу ничего не найдено. Попробуйте изменить
                  запрос.
                </p>
              ) : (
                <>
                  <p>В книге пока нет рецептов.</p>
                  {role ? (
                    <ButtonLink href="/recipes/new" variant="primary">
                      Добавить первый рецепт
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/login" variant="primary">
                      Войти, чтобы добавить рецепт
                    </ButtonLink>
                  )}
                </>
              )}
            </div>
          )}

          {!error && recipes.length > 0 && (
            <div className={loading ? styles.dimmed : undefined}>
              <p className={styles.count}>{pluralizeRecipes(total)}</p>

              <ul className={cardStyles.grid}>
                {recipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    favoriteBusy={favoriteBusyId === recipe.id}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </ul>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Назад
                  </Button>
                  <span className={styles.pageInfo}>
                    Страница {page} из {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Вперёд
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
