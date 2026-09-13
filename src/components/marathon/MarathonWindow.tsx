import MarathonHeader from './MarathonHeader';
import DayNavbar from './DayNavbar';
import DayView from './DayView';
import styles from './Marathon.module.css';
import type { Goal } from '@db/models/StreamEnrollment';

export type MarathonStream = {
  id: string;
  startDate: string;
  status: string;
  template: {
    id: string;
    title: string;
    description?: string;
    durationDays: number;
  };
};

export type MarathonRating = {
  rank: number | null;
  totalParticipants: number;
  weightLossPercent: number;
};

export type MarathonReport = {
  id: string;
  dayNumber: number;
  totalCalories: number;
  weightKg: number | null;
  filledAt: Date | string;
};

type MarathonWindowProps = {
  stream: MarathonStream;
  currentDayNumber: number;
  targetCalories: number | null;
  goal: Goal | null;
  rating: MarathonRating;
  reports: MarathonReport[];
  measurementDays: number[];
  trainingDays?: number[];
  restDays?: number[];
  healthyEatingDays?: number[];
  activeDay: number | null;
  onDayChange: (dayNumber: number) => void;
  onReportSaved?: () => void;
};

export default function MarathonWindow({
  stream,
  currentDayNumber,
  targetCalories,
  goal,
  rating,
  reports,
  measurementDays,
  trainingDays = [],
  restDays = [],
  healthyEatingDays = [],
  activeDay,
  onDayChange,
  onReportSaved,
}: MarathonWindowProps) {
  return (
    <div className={styles.window}>
      <MarathonHeader
        stream={stream}
        rating={rating}
      />

      <DayNavbar
        startDate={stream.startDate}
        durationDays={stream.template.durationDays}
        currentDayNumber={currentDayNumber}
        targetCalories={targetCalories}
        goal={goal}
        reports={reports}
        measurementDays={measurementDays}
        trainingDays={trainingDays}
        restDays={restDays}
        healthyEatingDays={healthyEatingDays}
        activeDay={activeDay}
        onDayChange={onDayChange}
      />

      {activeDay === null ? (
        <p className={styles.placeholder}>Марафон ещё не начат.</p>
      ) : (
        <DayView
          streamId={stream.id}
          dayNumber={activeDay}
          reports={reports}
          targetCalories={targetCalories}
          goal={goal}
          currentDayNumber={currentDayNumber}
          onReportSaved={onReportSaved}
        />
      )}
    </div>
  );
}
