import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import { ButtonLink } from '@/components/ui';
import HelpCard from '@/components/help/HelpCard';
import cardStyles from '@/components/help/HelpCard.module.css';
import {
  HELP_SECTION_LABELS,
  HELP_SECTION_ORDER,
  type HelpArticleListItem,
  type HelpListResponse,
  type HelpSection,
} from '@/types/help';
import styles from './index.module.css';

type Tab = 'all' | HelpSection;

function pluralizeArticles(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} статья`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} статьи`;
  }
  return `${count} статей`;
}

export default function HelpPage() {
  const role = useAuthStore((state) => state.role);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  // Поиск с задержкой, чтобы не дёргать API на каждый символ.
  useEffect(() => {
    const trimmed = searchInput.trim();
    const timer = setTimeout(() => setSearch(trimmed), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (tab !== 'all') params.set('section', tab);

        const res = await apiFetch(`/api/help?${params.toString()}`);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            json.message || json.error || 'Не удалось загрузить раздел'
          );
        }

        const data = json.data as HelpListResponse;
        if (cancelled) return;

        setArticles(data.items ?? []);
        setTotal(data.total ?? 0);
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
  }, [search, tab, role]);

  const isAdmin = role === 'admin';

  return (
    <main className="container">
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className="pageTitle">Правила и помощь</h1>
          <p className={styles.lead}>
            Как устроены марафоны, что нужно заполнять каждый день, как
            считается рейтинг и что делать в спорных ситуациях. Раздел открыт
            для всех.
          </p>
        </div>
        {isAdmin && (
          <ButtonLink href="/admin/help" variant="outline">
            Управление разделом
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
            placeholder="Поиск по правилам и помощи..."
            aria-label="Поиск по правилам и помощи"
          />
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Разделы помощи">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={tab === 'all' ? styles.tabActive : styles.tab}
            onClick={() => setTab('all')}
          >
            Все
          </button>
          {HELP_SECTION_ORDER.map((section) => (
            <button
              key={section}
              type="button"
              role="tab"
              aria-selected={tab === section}
              className={tab === section ? styles.tabActive : styles.tab}
              onClick={() => setTab(section)}
            >
              {HELP_SECTION_LABELS[section]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!error && loading && articles.length === 0 && (
        <div className="mutedBox">Загружаем раздел...</div>
      )}

      {!error && !loading && articles.length === 0 && (
        <div className={styles.empty}>
          {search ? (
            <p>По вашему запросу ничего не найдено. Попробуйте изменить запрос.</p>
          ) : (
            <>
              <p>Материалы пока не опубликованы.</p>
              {isAdmin && (
                <ButtonLink href="/admin/help" variant="primary">
                  Добавить первую статью
                </ButtonLink>
              )}
            </>
          )}
        </div>
      )}

      {!error && articles.length > 0 && (
        <div className={loading ? styles.dimmed : undefined}>
          <p className={styles.count}>{pluralizeArticles(total)}</p>
          <ul className={cardStyles.grid}>
            {articles.map((article) => (
              <HelpCard key={article.id} article={article} />
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
