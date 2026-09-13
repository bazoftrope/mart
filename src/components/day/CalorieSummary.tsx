import Link from 'next/link';
import { GOAL_LABELS } from '@/lib/calorieCalculator';
import type { Goal } from '@/types/participantDay';
import styles from './CalorieSummary.module.css';

type CalorieSummaryProps = {
  targetCalories: number | null;
  actualCalories: number;
  goal: Goal | null;
  isTargetMissed: boolean;
  profileCompleted: boolean;
};

export default function CalorieSummary({
  targetCalories,
  actualCalories,
  goal,
  isTargetMissed,
  profileCompleted,
}: CalorieSummaryProps) {
  if (targetCalories === null) {
    if (profileCompleted) {
      return null;
    }

    return (
      <div className={styles.calorieSummary}>
        <p>
          Для расчёта дневной нормы заполните анкету участника:{' '}
          <Link href="/onboarding">перейти к анкете</Link>
        </p>
      </div>
    );
  }

  const isGain = goal === 'gain';
  const calorieDifference = Math.round(actualCalories - targetCalories);

  const statusTitle = isTargetMissed
    ? isGain
      ? 'Недостаточно калорий'
      : 'Превышение лимита'
    : isGain
      ? 'Норма / профицит'
      : 'Норма / дефицит';

  let statusText = '';
  if (calorieDifference === 0) {
    statusText = 'Цель достигнута';
  } else if (isTargetMissed) {
    statusText = `${isGain ? 'Не хватает' : 'Превышение'}: ${Math.abs(calorieDifference)} ккал`;
  } else {
    statusText = `${isGain ? 'Профицит' : 'Остаток'}: ${Math.abs(calorieDifference)} ккал`;
  }

  const eyebrow = isGain
    ? 'Набор'
    : goal === 'maintain'
      ? 'Поддержание'
      : 'Дефицит';

  return (
    <div
      className={`${styles.calorieSummary} ${
        isTargetMissed ? styles.statusOver : styles.statusOk
      }`}
    >
      <div className={styles.topRow}>
        <span className={styles.iconCircle} aria-hidden>
          {isTargetMissed ? '✕' : '✓'}
        </span>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Дневной баланс · {eyebrow}</span>
          <span className={styles.statusTitle}>{statusTitle}</span>
        </div>
      </div>

      <div className={styles.divider} aria-hidden />

      <div className={styles.calorieSummaryValues}>
        <div className={styles.valueBlock}>
          <span className={styles.valueLabel}>Цель</span>
          <span className={styles.valueAmount}>
            {targetCalories}
            <span className={styles.valueUnit}>ккал</span>
          </span>
        </div>
        <span className={styles.valueSep} aria-hidden />
        <div className={styles.valueBlock}>
          <span className={styles.valueLabel}>Факт</span>
          <span className={styles.valueAmount}>
            {Math.round(actualCalories)}
            <span className={styles.valueUnit}>ккал</span>
          </span>
        </div>
      </div>

      <div className={styles.statusChip}>
        <span className={styles.chipDot} aria-hidden />
        {statusText}
      </div>

      {goal && (
        <div className={styles.calorieGoal}>Цель потока: {GOAL_LABELS[goal]}</div>
      )}
    </div>
  );
}
