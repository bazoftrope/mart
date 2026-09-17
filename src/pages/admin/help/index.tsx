import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient, ApiClientError } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui';
import {
  HELP_AUDIENCE_LABELS,
  HELP_SECTION_LABELS,
  type HelpArticleListItem,
  type HelpListResponse,
} from '@/types/help';
import styles from './AdminHelp.module.css';

export default function AdminHelpPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<HelpListResponse>('/api/help?all=1');
      setArticles(data.items ?? []);
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : 'Не удалось загрузить статьи'
      );
    } finally {
      setLoading(false);
    }
  }, []);

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

  async function handleDelete(article: HelpArticleListItem) {
    if (
      !window.confirm(
        `Удалить статью «${article.title}»? Действие необратимо.`
      )
    ) {
      return;
    }

    setActionError(null);
    setDeletingSlug(article.slug);
    try {
      await apiClient.delete(`/api/help/${article.slug}`);
      setArticles((prev) => prev.filter((item) => item.id !== article.id));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не удалось удалить статью'
      );
    } finally {
      setDeletingSlug(null);
    }
  }

  return (
    <main className="container">
      <header className={styles.header}>
        <div>
          <h1 className="pageTitle">Правила и помощь</h1>
          <p className={styles.lead}>
            Статьи публичного раздела <code>/help</code>. Черновики видны
            только в админке.
          </p>
        </div>
        <div className={styles.headerActions}>
          <ButtonLink href="/help" variant="outline">
            Открыть раздел
          </ButtonLink>
          <ButtonLink href="/admin/help/new" variant="primary">
            Добавить статью
          </ButtonLink>
        </div>
      </header>

      {loading && <div className="mutedBox">Загружаем статьи...</div>}
      {!loading && error && <p className="error">{error}</p>}
      {actionError && <p className="error">{actionError}</p>}

      {!loading && !error && articles.length === 0 && (
        <div className={styles.empty}>
          <p>Статей пока нет.</p>
          <ButtonLink href="/admin/help/new" variant="primary">
            Добавить первую статью
          </ButtonLink>
        </div>
      )}

      {!loading && !error && articles.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Заголовок</th>
              <th>Раздел</th>
              <th>Кому</th>
              <th>Порядок</th>
              <th>Статус</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td>
                  <Link
                    href={`/admin/help/${article.slug}`}
                    className={styles.titleLink}
                  >
                    {article.title}
                  </Link>
                  <p className={styles.slug}>/help/{article.slug}</p>
                </td>
                <td>{HELP_SECTION_LABELS[article.section]}</td>
                <td>{HELP_AUDIENCE_LABELS[article.audience]}</td>
                <td>{article.position}</td>
                <td>
                  <span
                    className={
                      article.isPublished ? styles.published : styles.draft
                    }
                  >
                    {article.isPublished ? 'Опубликована' : 'Черновик'}
                  </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <ButtonLink href={`/admin/help/${article.slug}`} variant="outline" size="sm">
                      <Pencil size={16} />
                      Изменить
                    </ButtonLink>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(article)}
                      disabled={deletingSlug === article.slug}
                    >
                      <Trash2 size={16} />
                      {deletingSlug === article.slug ? 'Удаляем...' : 'Удалить'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
