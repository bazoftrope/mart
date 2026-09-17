import { useState } from 'react';
import Link from 'next/link';
import ProductSearch from './ProductSearch';
import ReportTable from './ReportTable';
import CalorieSummary from './CalorieSummary';
import MetricBlock, { type MetricField, type MetricGroup } from './MetricBlock';
import Button from '@/components/ui/Button';
import { useParticipantDayStore, hasReportData } from '@/stores/participantDayStore';
import { isCalorieTargetMissed } from '@/lib/calorieCalculator';
import {
  MEAL_LABELS,
  MEAL_ORDER,
  defaultMealForNow,
  type MealType,
} from '@/lib/nutritionCalculator';
import { HELP_SLUG_REPORT_GUIDE } from '@/lib/helpSlug';
import styles from './DayReport.module.css';

type DayReportProps = {
  streamId: string;
  dayNumber: number;
  isEditable: boolean;
  onSaved?: () => void;
};

export default function DayReport({ streamId, dayNumber, isEditable, onSaved }: DayReportProps) {
  const {
    lines,
    metrics,
    saving,
    saveError,
    data,
    addProductLine,
    updateLine,
    removeLine,
    updateMetric,
    setTrainingDone,
    saveReport,
  } = useParticipantDayStore();

  const [mealType, setMealType] = useState<MealType>(() => defaultMealForNow());

  const canSave = hasReportData(lines, metrics);

  const actualCalories = lines.reduce((sum, line) => sum + line.lineCalories, 0);
  const macros = lines.reduce(
    (acc, line) => ({
      protein: acc.protein + line.lineProtein,
      fat: acc.fat + line.lineFat,
      carbs: acc.carbs + line.lineCarbs,
    }),
    { protein: 0, fat: 0, carbs: 0 }
  );
  const targetCalories = data?.targetCalories ?? null;
  const goal = data?.goal ?? null;
  const isTargetMissed =
    targetCalories !== null &&
    isCalorieTargetMissed(goal, actualCalories, targetCalories);

  const metricDisabled = !isEditable || saving;
  const isMeasurementDay = Boolean(data?.isMeasurementDay);

  const handleSave = async () => {
    await saveReport(streamId, dayNumber);
    const { saveError: err } = useParticipantDayStore.getState();
    if (!err) onSaved?.();
  };

  const bodyMetricFields: MetricField[] = [
    {
      kind: 'number',
      key: 'weightKg',
      label: 'Вес (кг)',
      min: 20,
      max: 300,
      step: 1,
      value: metrics.weightKg,
      onChange: (value) => updateMetric('weightKg', value),
      disabled: metricDisabled,
    },
    {
      kind: 'number',
      key: 'chestCm',
      label: 'ОГ — грудь (см)',
      min: 30,
      max: 300,
      step: 0.5,
      value: metrics.chestCm,
      onChange: (value) => updateMetric('chestCm', value),
      disabled: metricDisabled,
    },
    {
      kind: 'number',
      key: 'waistCm',
      label: 'ОТ — талия (см)',
      min: 30,
      max: 300,
      step: 0.5,
      value: metrics.waistCm,
      onChange: (value) => updateMetric('waistCm', value),
      disabled: metricDisabled,
    },
    {
      kind: 'number',
      key: 'hipCm',
      label: 'ОБ — бёдра (см)',
      min: 30,
      max: 300,
      step: 0.5,
      value: metrics.hipCm,
      onChange: (value) => updateMetric('hipCm', value),
      disabled: metricDisabled,
    },
    {
      kind: 'number',
      key: 'legCm',
      label: 'ОН — нога (см)',
      min: 20,
      max: 200,
      step: 0.5,
      value: metrics.legCm,
      onChange: (value) => updateMetric('legCm', value),
      disabled: metricDisabled,
    },
  ];

  const dailyMetricFields: MetricField[] = [
    {
      kind: 'number',
      key: 'waterLiters',
      label: 'Вода (л)',
      min: 0,
      max: 50,
      step: 1,
      value: metrics.waterLiters,
      onChange: (value) => updateMetric('waterLiters', value),
      disabled: metricDisabled,
    },
    {
      kind: 'number',
      key: 'steps',
      label: 'Шаги',
      min: 0,
      max: 100000,
      step: 1,
      value: metrics.steps,
      onChange: (value) => updateMetric('steps', value),
      disabled: metricDisabled,
    },
    {
      kind: 'number',
      key: 'sleepHours',
      label: 'Сон (ч)',
      min: 0,
      max: 24,
      step: 1,
      value: metrics.sleepHours,
      onChange: (value) => updateMetric('sleepHours', value),
      disabled: metricDisabled,
    },
  ];

  // Вес и охваты заполняются только в день замера, поэтому секция появляется
  // в карточке метрик не всегда, а дневные показатели — каждый день.
  const metricGroups: MetricGroup[] = [
    ...(isMeasurementDay
      ? [{ key: 'body', title: 'Вес и охваты', fields: bodyMetricFields }]
      : []),
    {
      key: 'daily',
      ...(isMeasurementDay ? { title: 'Вода, шаги, сон, тренировка' } : {}),
      fields: dailyMetricFields,
      children: (
        <label className={styles.trainingField}>
          <span>Тренировка</span>
          <input
            type="checkbox"
            checked={metrics.trainingDone === true}
            onChange={(e) => setTrainingDone(e.target.checked)}
            disabled={metricDisabled}
            className={styles.trainingCheckbox}
            aria-label="Тренировка была"
          />
        </label>
      ),
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.titleRow}>
        <Link
          href={`/help/${HELP_SLUG_REPORT_GUIDE}`}
          className={styles.helpLink}
        >
          Как заполнить отчёт?
        </Link>
      </div>

      <div className={styles.reportLayout}>
        <div className={styles.summaryColumn}>
          <div className={styles.summaryCell}>
            <CalorieSummary
              targetCalories={targetCalories}
              actualCalories={actualCalories}
              macros={macros}
              goal={goal}
              isTargetMissed={isTargetMissed}
              profileCompleted={Boolean(data?.profileCompleted)}
            />
          </div>

          <div className={styles.metricsCell}>
            <MetricBlock title="Метрики" groups={metricGroups} />
          </div>
        </div>

        <div className={styles.tableCell}>
          {isEditable && (
            <div className={styles.searchDiv}>
              <div
                className={styles.mealSelector}
                role="tablist"
                aria-label="Приём пищи"
              >
                {MEAL_ORDER.map((meal) => (
                  <button
                    key={meal}
                    type="button"
                    role="tab"
                    aria-selected={mealType === meal}
                    onClick={() => setMealType(meal)}
                    disabled={saving}
                    className={`${styles.mealTab} ${
                      mealType === meal ? styles.mealTabActive : ''
                    }`}
                  >
                    {MEAL_LABELS[meal]}
                  </button>
                ))}
              </div>
              <ProductSearch
                onSelect={(product) => addProductLine(product, mealType)}
                disabled={saving}
              />

            </div>
          )}

          <ReportTable
            lines={lines}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            readOnly={!isEditable}
          />
        </div>
      </div>

      {isEditable && (
        <div className={styles.saveBtnDiv}>
          <Button
            variant="primary"
            size="lg"
            loading={saving}
            disabled={!canSave}
            onClick={handleSave}
            aria-label={saving ? 'Сохранение отчёта' : 'Сохранить отчёт'}
          >
            {saving ? 'Сохранение...' : 'Сохранить отчёт'}
          </Button>
        </div>
      )}

      {saveError && <p className={styles.saveError}>{saveError}</p>}

      {data?.report && (
        <p className={styles.lastUpdated}>
          Последнее обновление: {new Date(data.report.updatedAt).toLocaleString()}
        </p>
      )}
    </section>
  );
}
