import DayNavbarButton from './DayNavbarButton';
import styles from './Marathon.module.css';
import { addDays, parseISO, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Goal } from '@db/models/StreamEnrollment';
import { isCalorieTargetMissed } from '@/lib/calorieCalculator';

type DayNavbarReport = { dayNumber: number; totalCalories: number; weightKg?: number | null };

type DayNavbarProps = {
  /** Если не задана — даты в плитках не показываются (например, для шаблона). */
  startDate?: string;
  durationDays: number;
  /** Если не задан — все дни доступны для выбора. */
  currentDayNumber?: number;
  targetCalories?: number | null;
  goal?: Goal | null;
  reports?: DayNavbarReport[];
  measurementDays?: number[];
  trainingDays?: number[];
  restDays?: number[];
  healthyEatingDays?: number[];
  /** Дни с содержимым, но без отчёта (например, заполненные дни шаблона). */
  filledDays?: number[];
  activeDay: number | null;
  onDayChange: (dayNumber: number) => void;
  ariaLabel?: string;
};

export default function DayNavbar({
  startDate,
  durationDays,
  currentDayNumber,
  targetCalories = null,
  goal = null,
  reports = [],
  measurementDays = [],
  trainingDays = [],
  restDays = [],
  healthyEatingDays = [],
  filledDays = [],
  activeDay,
  onDayChange,
  ariaLabel = 'Дни марафона',
}: DayNavbarProps) {
  const reportMap = new Map(reports.map((r) => [r.dayNumber, r.totalCalories]));
  const measurementDaySet = new Set(measurementDays);
  const trainingDaySet = new Set(trainingDays);
  const restDaySet = new Set(restDays);
  const healthyDaySet = new Set(healthyEatingDays);
  const filledDaySet = new Set(filledDays);

  return (
    <nav className={styles.dayNavbar} aria-label={ariaLabel}>
      {Array.from({ length: durationDays }, (_, i) => {
        const dayNumber = i + 1;
        const dayDate = startDate ? addDays(parseISO(startDate), i) : null;
        const weekday = dayDate ? format(dayDate, 'EE', { locale: ru }) : undefined;
        const dateLabel = dayDate ? format(dayDate, 'dd.MM') : undefined;
        const isAccessible = currentDayNumber === undefined || dayNumber <= currentDayNumber;
        const isActive = dayNumber === activeDay;
        const isCurrent = currentDayNumber !== undefined && dayNumber === currentDayNumber;
        const calories = reportMap.get(dayNumber);
        const isFilled = calories !== undefined || filledDaySet.has(dayNumber);
        const isCalorieProblem =
          targetCalories !== null &&
          calories !== undefined &&
          isCalorieTargetMissed(goal, calories, targetCalories);

        return (
          <DayNavbarButton
            key={dayNumber}
            dayNumber={dayNumber}
            weekday={weekday}
            dateLabel={dateLabel}
            isAccessible={isAccessible}
            isActive={isActive}
            isCurrent={isCurrent}
            isFilled={isFilled}
            isCalorieProblem={isCalorieProblem}
            isMeasurementDay={measurementDaySet.has(dayNumber)}
            isTrainingDay={trainingDaySet.has(dayNumber)}
            isRestDay={restDaySet.has(dayNumber)}
            isHealthyEatingDay={healthyDaySet.has(dayNumber)}
            calories={calories ?? null}
            onSelect={onDayChange}
          />
        );
      })}
    </nav>
  );

}
