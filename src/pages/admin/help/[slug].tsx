import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import HelpForm, {
  type HelpFormValues,
} from '@/components/help/HelpForm';
import type { HelpArticle } from '@/types/help';
import styles from './AdminHelpEdit.module.css';

function toFormValues(article: HelpArticle): HelpFormValues {
  return {
    title: article.title,
    slug: article.slug,
    summary: article.summary ?? '',
    content: article.content,
    section: article.section,
    audience: article.audience,
    position: article.position,
    isPublished: article.isPublished,
  };
}

export default function AdminHelpEditPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';

  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<HelpArticle>(`/api/help/${slug}`);
      setArticle(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить статью'
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

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

  async function handleSubmit(values: HelpFormValues) {
    setSaved(false);
    const updated = await apiClient.put<HelpArticle>(
      `/api/help/${slug}`,
      values
    );

    if (updated.slug !== slug) {
      router.replace(`/admin/help/${updated.slug}`);
      return;
    }

    setArticle(updated);
    setSaved(true);
  }

  async function handleDelete() {
    if (!article) return;
    if (!window.confirm(`Удалить статью «${article.title}»? Действие необратимо.`)) {
      return;
    }

    setError(null);
    setDeleting(true);
    try {
      await apiClient.delete(`/api/help/${article.slug}`);
      router.push('/admin/help');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось удалить статью'
      );
      setDeleting(false);
    }
  }

  return (
    <main className="containerMd">
      <p>
        <Link href="/admin/help" className="backLink">
          ← К управлению разделом
        </Link>
      </p>

      <div className={styles.header}>
        <h1 className="pageTitle">Редактирование статьи</h1>
        {article && (
          <div className={styles.headerActions}>
            <Link href={`/help/${article.slug}`} className="btn btnOutline">
              Открыть в разделе
            </Link>
            <button
              type="button"
              className="btn btnDanger"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={16} />
              {deleting ? 'Удаляем...' : 'Удалить'}
            </button>
          </div>
        )}
      </div>

      {loading && <div className="mutedBox">Загружаем статью...</div>}
      {!loading && error && <p className="error">{error}</p>}
      {saved && <p className="textSuccess">Изменения сохранены.</p>}

      {!loading && article && (
        <HelpForm
          initialValues={toFormValues(article)}
          submitLabel="Сохранить изменения"
          onSubmit={handleSubmit}
          onCancel={() => router.push('/admin/help')}
        />
      )}
    </main>
  );
}
