import DayNavbarButton from './DayNavbarButton';
import styles from './Marathon.module.css';
import { addDays, parseISO, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Goal } from '@db/models/StreamEnrollment';
import { isCalorieTargetMissed } from '@/lib/calorieCalculator';

type DayNavbarReport = { dayNumber: number; totalCalories: number; weightKg?: number | null };

type DayNavbarProps = {
  startDate: string;
  durationDays: number;
  currentDayNumber: number;
  targetCalories: number | null;
  goal: Goal | null;
  reports: DayNavbarReport[];
  measurementDays: number[];
  trainingDays?: number[];
  restDays?: number[];
  healthyEatingDays?: number[];
  activeDay: number | null;
  onDayChange: (dayNumber: number) => void;
};

export default function DayNavbar({
  startDate,
  durationDays,
  currentDayNumber,
  targetCalories,
  goal,
  reports,
  measurementDays,
  trainingDays = [],
  restDays = [],
  healthyEatingDays = [],
  activeDay,
  onDayChange,
}: DayNavbarProps) {
  const reportMap = new Map(reports.map((r) => [r.dayNumber, r.totalCalories]));
  const measurementDaySet = new Set(measurementDays);
  const trainingDaySet = new Set(trainingDays);
  const restDaySet = new Set(restDays);
  const healthyDaySet = new Set(healthyEatingDays);

  return (
    <nav className={styles.dayNavbar} aria-label="Дни марафона">
      {Array.from({ length: durationDays }, (_, i) => {
        const dayNumber = i + 1;
        const dayDate = addDays(parseISO(startDate), i);
        const weekday = format(dayDate, 'EE', { locale: ru });
        const dateLabel = format(dayDate, 'dd.MM');
        const isAccessible = dayNumber <= currentDayNumber;
        const isActive = dayNumber === activeDay;
        const isCurrent = dayNumber === currentDayNumber;
        const calories = reportMap.get(dayNumber);
        const isFilled = calories !== undefined;
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
