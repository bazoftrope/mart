import { useId, type ReactNode } from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import type { ContentAttachmentData } from '@/types/attachments';
import styles from './ContentCard.module.css';

export type ContentCardProps = {
  title: string;
  description?: string | null;
  /** Внутренний href карточки: и фото, и текст ведут сюда. */
  href: string;
  /** Ссылка на правку. Если не передана — «Изменить» не рендерится. */
  editHref?: string;
  /** Многострочный текст: ингредиенты у рецепта, упражнения у тренировки. */
  lines: string;
  /** Подпись перед перечислением: «Ингредиенты», «Упражнения». */
  linesLabel: string;
  /** Форма слова для счётчика остатка: ['ингредиент', 'ингредиента', 'ингредиентов']. */
  linesPlural: [string, string, string];
  attachments?: ContentAttachmentData[];
  isFavorite: boolean;
  favoriteBusy?: boolean;
  onToggleFavorite: () => void;
  /** Бейджи поверх фото — категория, время приготовления и т.п. */
  category?: string;
  cookTime?: string;
  /** Иконка для бейджа времени (у рецептов — часы). */
  timeIcon?: ReactNode;
};

const LINES_PREVIEW_LIMIT = 3;

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function pluralize(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/**
 * Карточка элемента «книги»: рецепта или тренировки.
 *
 * Обе книги устроены одинаково (заголовок, описание, список строк, лайк,
 * фото-обложка), поэтому вид вынесен в общий компонент — раньше RecipeCard
 * и WorkoutCard дублировали одну и ту же разметку и расходились в оформлении.
 *
 * Фото-обложка опциональна: без вложений-картинок карточка остаётся молочной
 * панелью с текстом, но сохраняет ту же геометрию.
 */
export default function ContentCard({
  title,
  description,
  href,
  editHref,
  lines,
  linesLabel,
  linesPlural,
  attachments,
  isFavorite,
  favoriteBusy = false,
  onToggleFavorite,
  category,
  cookTime,
  timeIcon,
}: ContentCardProps) {
  const titleId = useId();
  const items = splitLines(lines);
  const preview = items.slice(0, LINES_PREVIEW_LIMIT);
  const restCount = items.length - preview.length;
  const image = attachments?.find((attachment) => attachment.kind === 'image');
  const hasBadges = Boolean(category || cookTime);

  return (
    <li className={image ? `${styles.card} ${styles.hasMedia}` : styles.card}>
      {image && (
        <div
          className={styles.media}
          style={{ backgroundImage: `url(${image.url})` }}
          role="img"
          aria-label={title}
        />
      )}
      <div className={styles.scrim} aria-hidden="true" />

      {/* Бейджи накладываются на фото-обложку. Без фото показывать их негде:
          .topRow позиционирован абсолютно и наехал бы на заголовок. */}
      {image && hasBadges && (
        <div className={styles.topRow}>
          <div className={styles.badges}>
            {category && <span className={styles.category}>{category}</span>}
            {cookTime && (
              <span className={styles.cookTime}>
                {timeIcon}
                {cookTime}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.body}>
        <h3 id={titleId} className={styles.title}>
          {title}
        </h3>

        {description && <p className={styles.description}>{description}</p>}

        {preview.length > 0 && (
          <div className={styles.linesBlock}>
            <span className={styles.label}>{linesLabel}</span>
            <ul className={styles.lines}>
              {preview.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
            {restCount > 0 && (
              <p className={styles.linesMore}>
                +{restCount} {pluralize(restCount, linesPlural)}
              </p>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.favorite}>
            <FavoriteButton
              active={isFavorite}
              busy={favoriteBusy}
              onToggle={onToggleFavorite}
            />
          </span>

          {editHref && (
            <Link href={editHref} className={styles.editLink}>
              <Pencil size={14} aria-hidden="true" />
              Изменить
            </Link>
          )}
        </div>
      </div>

      {/*
        Ссылка на всю карточку: клик по фото и тексту открывает элемент.
        Имя ссылки берём из заголовка, чтобы не дублировать текст для скринридера.
      */}
      <Link href={href} className={styles.cardLink} aria-labelledby={titleId} />
    </li>
  );
}
