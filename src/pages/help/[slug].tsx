import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import HelpCard from '@/components/help/HelpCard';
import cardStyles from '@/components/help/HelpCard.module.css';
import {
  HELP_AUDIENCE_LABELS,
  HELP_SECTION_LABELS,
  type HelpArticle,
  type HelpArticleListItem,
  type HelpListResponse,
} from '@/types/help';
import styles from './[slug].module.css';

const RELATED_LIMIT = 4;

export default function HelpArticlePage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';

  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [related, setRelated] = useState<HelpArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  const load = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/help/${slug}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json.message || json.error || 'Не удалось загрузить статью'
        );
      }

      const data = json.data as HelpArticle;
      setArticle(data);

      // Другие материалы того же раздела — необязательный блок.
      const listRes = await apiFetch(
        `/api/help?section=${encodeURIComponent(data.section)}`
      );
      if (listRes.ok) {
        const listJson = await listRes.json().catch(() => ({}));
        const items = (listJson.data as HelpListResponse | undefined)?.items ?? [];
        setRelated(
          items.filter((item) => item.id !== data.id).slice(0, RELATED_LIMIT)
        );
      } else {
        setRelated([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="containerMd">
      <p>
        <Link href="/help" className="backLink">
          ← К правилам и помощи
        </Link>
      </p>

      {loading && <div className="mutedBox">Загружаем статью...</div>}

      {!loading && error && <p className="error">{error}</p>}

      {!loading && article && (
        <article className={styles.article}>
          <div className={styles.badges}>
            <span className={styles.sectionBadge}>
              {HELP_SECTION_LABELS[article.section]}
            </span>
            <span className={styles.audienceBadge}>
              {HELP_AUDIENCE_LABELS[article.audience]}
            </span>
          </div>

          <h1 className={styles.title}>{article.title}</h1>

          {article.summary && (
            <p className={styles.summary}>{article.summary}</p>
          )}

          <div
            className={styles.richText}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          <p className={styles.updated}>
            Обновлено {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
          </p>

          {related.length > 0 && (
            <section className={styles.related}>
              <h2 className={styles.relatedTitle}>
                Другие материалы раздела «{HELP_SECTION_LABELS[article.section]}»
              </h2>
              <ul className={cardStyles.grid}>
                {related.map((item) => (
                  <HelpCard key={item.id} article={item} />
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </main>
  );
}
