import styles from './FavoriteButton.module.css';

type FavoriteButtonProps = {
  active: boolean;
  busy?: boolean;
  /** Компактный вариант для карточек; крупнее — на страницах рецепта и тренировки. */
  withLabel?: boolean;
  onToggle: () => void;
};

/**
 * Кнопка «Лайк». Раньше это было сердечко-иконка, но иконка не совпадала
 * с общим текстовым языком карточек, поэтому лайк — обычная надпись в рамке:
 * не в избранном — контурная, в избранном — с мятной заливкой.
 */
export default function FavoriteButton({
  active,
  busy = false,
  withLabel = false,
  onToggle,
}: FavoriteButtonProps) {
  const className = [
    styles.button,
    active ? styles.active : '',
    withLabel ? styles.withLabel : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      disabled={busy}
      aria-pressed={active}
      title={active ? 'Убрать из избранного' : 'Добавить в избранное'}
    >
      {active ? 'В избранном' : 'Лайк'}
    </button>
  );
}
