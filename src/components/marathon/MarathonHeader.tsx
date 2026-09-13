import Link from 'next/link';
import MarathonChatPopup from '@/components/Chat/MarathonChatPopup';
import type { MarathonRating, MarathonStream } from './MarathonWindow';
import styles from './Marathon.module.css';

type MarathonHeaderProps = {
  stream: MarathonStream;
  rating: MarathonRating;
};

export default function MarathonHeader({
  stream,
  rating,
}: MarathonHeaderProps) {
  const ratingText =
    rating && rating.rank !== null && rating.totalParticipants > 0
      ? `Вы: ${rating.rank} из ${rating.totalParticipants} · ${
          rating.weightLossPercent > 0
            ? `−${rating.weightLossPercent}%`
            : `${rating.weightLossPercent}%`
        }`
      : 'Рейтинг пока не рассчитан';

  return (
    <header className={styles.header}>
      <Link href="/dashboard" className={styles.backLink}>
        ←
      </Link>

      <div className={styles.ratingLine}>
        <h2 className={styles.title}>{stream.template.title}</h2>
        <span>{ratingText}</span>
        <MarathonChatPopup streamId={stream.id} streamStatus={stream.status} />
      </div>
    </header>
  );
}
