import { Heart } from 'lucide-react';
import styles from './FavoriteButton.module.css';

type FavoriteButtonProps = {
  active: boolean;
  busy?: boolean;
  withLabel?: boolean;
  onToggle: () => void;
};

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
      <Heart
        size={withLabel ? 18 : 16}
        className={styles.icon}
        fill={active ? 'currentColor' : 'none'}
      />
      {withLabel && <span>{active ? 'В избранном' : 'В избранное'}</span>}
    </button>
  );
}
