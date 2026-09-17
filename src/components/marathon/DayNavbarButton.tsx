import { Icon } from '@/components/icons';
import styles from './Marathon.module.css';

type DayNavbarButtonProps = {
  dayNumber: number;
  weekday: string;
  dateLabel: string;
  isAccessible: boolean;
  isActive: boolean;
  isCurrent: boolean;
  isFilled: boolean;
  isCalorieProblem: boolean;
  isMeasurementDay: boolean;
  isTrainingDay: boolean;
  isRestDay: boolean;
  isHealthyEatingDay: boolean;
  calories: number | null;
  onSelect: (dayNumber: number) => void;
};

export default function DayNavbarButton({
  dayNumber,
  weekday,
  dateLabel,
  isAccessible,
  isActive,
  isCurrent,
  isFilled,
  isCalorieProblem,
  isMeasurementDay,
  isTrainingDay,
  isRestDay,
  isHealthyEatingDay,
  calories,
  onSelect,
}: DayNavbarButtonProps) {
  // Выбранным может быть только доступный день: будущие дни не нажимаются.
  const isSelected = isActive && isAccessible;

  const className = [
    styles.dayItem,
    isAccessible ? styles.dayAccessible : styles.dayDisabled,
    isSelected ? styles.dayActive : '',
    isCurrent ? styles.dayCurrent : '',
    isFilled ? (isCalorieProblem ? styles.dayOverLimit : styles.dayFilled) : '',
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperClassName = [
    styles.dayItemBox,
    isCurrent ? styles.dayItemBoxCurrent : '',
  ]
    .filter(Boolean)
    .join(' ');

  const flags: Array<{ key: string; name: 'mesure' | 'training' | 'rest' | 'diet_food'; label: string }> = [];
  // diet_food — всегда первым в ряду иконок
  if (isHealthyEatingDay) flags.push({ key: 'healthy', name: 'diet_food', label: 'День здоровой еды' });
  if (isMeasurementDay) flags.push({ key: 'measurement', name: 'mesure', label: 'День замера' });
  if (isTrainingDay) flags.push({ key: 'training', name: 'training', label: 'День тренировки' });
  if (isRestDay) flags.push({ key: 'rest', name: 'rest', label: 'День отдыха' });

  const content = (
    <>
      <span className={styles.dayDate}>{weekday} · {dateLabel}</span>
      <span className={styles.dayNumber}>{dayNumber}</span>
      <span className={styles.dayFlagsBar}>
        {flags.map((flag) => (
          <Icon
            key={flag.key}
            name={flag.name}
            width={16}
            height={16}
            className={styles.dayFlagIcon}
            aria-label={flag.label}
          />
        ))}
      </span>
      <span className={styles.dayCaloriesSlot}>
        {isFilled && calories !== null ? (
          <span
            className={`${styles.dayCalories} ${
              isCalorieProblem ? styles.dayCaloriesOver : ''
            }`}
          >
            {calories.toFixed(0)} ккал
          </span>
        ) : null}
      </span>
    </>
  );

  const control = !isAccessible ? (
    <div className={className}>{content}</div>
  ) : (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(dayNumber)}
      aria-current={isSelected ? 'true' : undefined}
    >
      {content}
    </button>
  );

  return <div className={wrapperClassName}>{control}</div>;
}
