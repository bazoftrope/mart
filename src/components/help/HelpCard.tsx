import Link from 'next/link';
import {
  HELP_AUDIENCE_LABELS,
  HELP_SECTION_LABELS,
  type HelpArticleListItem,
} from '@/types/help';
import styles from './HelpCard.module.css';

type HelpCardProps = {
  article: HelpArticleListItem;
};

export default function HelpCard({ article }: HelpCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.badges}>
        <span className={styles.sectionBadge}>
          {HELP_SECTION_LABELS[article.section]}
        </span>
        <span className={styles.audienceBadge}>
          {HELP_AUDIENCE_LABELS[article.audience]}
        </span>
      </div>

      <Link href={`/help/${article.slug}`} className={styles.titleLink}>
        <h3 className={styles.title}>{article.title}</h3>
      </Link>

      {article.summary && <p className={styles.summary}>{article.summary}</p>}

      <p className={styles.meta}>
        Обновлено{' '}
        {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
      </p>
    </li>
  );
}
