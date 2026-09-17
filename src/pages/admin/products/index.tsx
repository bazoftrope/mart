import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui';
import type { ProductDto, ProductListResponse } from '@/types/product';
import styles from './AdminProducts.module.css';

const LIMIT = 20;

export default function AdminProductsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProductDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (query) params.set('search', query);

      const data = await apiClient.get<ProductListResponse>(
        `/api/admin/products?${params.toString()}`
      );
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'admin') {
      router.push('/login');
      return;
    }
    load();
  }, [router, load]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function handleDelete(product: ProductDto) {
    if (
      !window.confirm(
        `Удалить продукт «${product.name}»? Действие необратимо.`
      )
    ) {
      return;
    }

    setActionError(null);
    setDeletingId(product.id);
    try {
      await apiClient.delete(`/api/admin/products/${product.id}`);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не удалось удалить продукт'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="container">
      <header className={styles.header}>
        <div>
          <h1 className="pageTitle">Каталог продуктов</h1>
          <p className={styles.lead}>
            Общая база продуктов и блюд: ккал и БЖУ на 100 г. Используется в
            отчётах участников.
          </p>
        </div>
        <div className={styles.headerActions}>
          <ButtonLink href="/admin/products/new" variant="primary">
            Добавить продукт
          </ButtonLink>
        </div>
      </header>

      <form className={styles.toolbar} onSubmit={handleSearchSubmit}>
        <input
          type="search"
          className={`input ${styles.search}`}
          placeholder="Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Найти
        </Button>
        {query && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch('');
              setQuery('');
              setPage(1);
            }}
          >
            Сбросить
          </Button>
        )}
      </form>

      {loading && <div className="mutedBox">Загружаем каталог...</div>}
      {!loading && error && <p className="error">{error}</p>}
      {actionError && <p className="error">{actionError}</p>}

      {!loading && !error && items.length === 0 && (
        <div className={styles.empty}>
          {query ? 'Ничего не найдено.' : 'Каталог пуст.'}
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th className={styles.numCol}>ккал/100г</th>
                <th className={styles.numCol}>Б</th>
                <th className={styles.numCol}>Ж</th>
                <th className={styles.numCol}>У</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td className={styles.numCol}>{product.calories}</td>
                  <td className={styles.numCol}>{product.protein}</td>
                  <td className={styles.numCol}>{product.fat}</td>
                  <td className={styles.numCol}>{product.carbs}</td>
                  <td>
                    <div className={styles.actionsCell}>
                      <ButtonLink
                        href={`/admin/products/${product.id}`}
                        variant="outline"
                        size="sm"
                        aria-label={`Редактировать ${product.name}`}
                      >
                        <Pencil size={15} />
                      </ButtonLink>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product)}
                        disabled={deletingId === product.id}
                        aria-label={`Удалить ${product.name}`}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Назад
            </Button>
            <span className={styles.pageInfo}>
              Страница {page} из {totalPages} · всего {total}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Вперёд
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
