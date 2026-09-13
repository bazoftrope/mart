import type { ParticipantDayData } from '@/types/participantDay';
import { Icon } from '@/components/icons';
import styles from './DayHeader.module.css';

type DayHeaderProps = {
  data: ParticipantDayData;
};

type DayBadge = {
  key: string;
  icon: 'mesure' | 'training' | 'rest' | 'diet_food';
  label: string;
  hint: string;
  className: string;
};

const BADGE_CONFIG: Array<{
  flag: keyof Pick<ParticipantDayData, 'isMeasurementDay' | 'isTrainingDay' | 'isRestDay' | 'isHealthyEatingDay'>;
  icon: DayBadge['icon'];
  label: string;
  hint: string;
  className: string;
}> = [
  {
    flag: 'isMeasurementDay',
    icon: 'mesure',
    label: 'День замера',
    hint: 'Заполните вес и охваты',
    className: styles.badgeMeasurement,
  },
  {
    flag: 'isTrainingDay',
    icon: 'training',
    label: 'День тренировки',
    hint: 'Запланирована тренировка',
    className: styles.badgeTraining,
  },
  {
    flag: 'isRestDay',
    icon: 'rest',
    label: 'День отдыха',
    hint: 'Восстановление без нагрузки',
    className: styles.badgeRest,
  },
  {
    flag: 'isHealthyEatingDay',
    icon: 'diet_food',
    label: 'День здоровой еды',
    hint: 'Фокус на чистом питании',
    className: styles.badgeHealthy,
  },
];

export default function DayHeader({ data }: DayHeaderProps) {
  const isLocked = data.dayNumber > data.currentDayNumber;

  const badges: DayBadge[] = BADGE_CONFIG.filter((cfg) => data[cfg.flag]).map(
    (cfg) => ({
      key: cfg.flag,
      icon: cfg.icon,
      label: cfg.label,
      hint: cfg.hint,
      className: cfg.className,
    })
  );

  return (
    <header className={styles.header}>
      {badges.length > 0 && (
        <div className={styles.badges}>
          {badges.map((badge) => (
            <span key={badge.key} className={`${styles.badge} ${badge.className}`}>
              <Icon name={badge.icon} width={28} height={28} aria-hidden="true" />
              <span className={styles.badgeText}>
                <span className={styles.badgeLabel}>{badge.label}</span>
                <span className={styles.badgeHint}>{badge.hint}</span>
              </span>
            </span>
          ))}
        </div>
      )}

      {isLocked && (
        <p className={styles.notice}>
          Этот день ещё недоступен для редактирования.
        </p>
      )}
    </header>
  );
}
