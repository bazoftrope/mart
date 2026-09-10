import Link from 'next/link';
import ProductSearch from '@/components/ProductSearch';
import ReportTable from '@/components/ReportTable';
import PulseReadingsForm from '@/components/PulseReadingsForm';
import CalorieSummary from './CalorieSummary';
import MetricBlock, { type MetricField } from './MetricBlock';
import { useParticipantDayStore } from '@/stores/participantDayStore';
import { hasAnyData } from '@/stores/participantDayStore';
import { isCalorieTargetMissed } from '@/lib/calorieCalculator';
import { HELP_SLUG_REPORT_GUIDE } from '@/lib/helpSlug';
import styles from './DayReport.module.css';

type DayReportProps = {
  streamId: string;
  dayNumber: number;
  isEditable: boolean;
};

export default function DayReport({ streamId, dayNumber, isEditable }: DayReportProps) {
  const {
    lines,
    metrics,
    pulseReadings,
    saving,
    saveError,
    data,
    addProductLine,
    updateLine,
    removeLine,
    updateMetric,
    setTrainingDone,
    addPulseReading,
    updatePulseReading,
    removePulseReading,
    saveReport,
  } = useParticipantDayStore();

  const canSave = hasAnyData(lines, metrics, pulseReadings);

  const actualCalories = lines.reduce((sum, line) => sum + line.lineCalories, 0);
  const targetCalories = data?.targetCalories ?? null;
  const goal = data?.goal ?? null;
  const isTargetMissed =
    targetCalories !== null &&
    isCalorieTargetMissed(goal, actualCalories, targetCalories);

  const metricDisabled = !isEditable || saving;
  const isMeasurementDay = Boolean(data?.isMeasurementDay);

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

  return (
    <section className={styles.section}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Отчёт</h2>
        <Link
          href={`/help/${HELP_SLUG_REPORT_GUIDE}`}
          className={styles.helpLink}
        >
          Как заполнить отчёт?
        </Link>
      </div>

      {isEditable && (
        <div className={styles.searchDiv}>
          <ProductSearch onSelect={addProductLine} disabled={saving} />
        </div>
      )}

      <div className={styles.reportLayout}>
        <CalorieSummary
          targetCalories={targetCalories}
          actualCalories={actualCalories}
          goal={goal}
          isTargetMissed={isTargetMissed}
          profileCompleted={Boolean(data?.profileCompleted)}
        />
        <div className={styles.tableWrap}>
          <ReportTable
            lines={lines}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            readOnly={!isEditable}
            headerStatus={
              targetCalories === null
                ? undefined
                : isTargetMissed
                  ? 'over'
                  : 'ok'
            }
          />
        </div>
      </div>

      <div className={styles.metricsSection}>
        <h3 className={styles.metricsTitle}>Метрики</h3>
        <div className={styles.metricsRow}>
          {isMeasurementDay && (
            <MetricBlock title="Вес и охваты" fields={bodyMetricFields} />
          )}

          <MetricBlock title="Вода, шаги, сон, тренировка" fields={dailyMetricFields}>
            <label className={styles.trainingField}>
              <span>Тренировка</span>
              <div className={styles.trainingOptions}>
                <button
                  type="button"
                  className={`${styles.trainingOption} ${
                    metrics.trainingDone === null ? styles.trainingActive : ''
                  }`}
                  disabled={metricDisabled}
                  onClick={() => setTrainingDone(null)}
                >
                  Не отмечено
                </button>
                <button
                  type="button"
                  className={`${styles.trainingOption} ${
                    metrics.trainingDone === true ? styles.trainingActive : ''
                  }`}
                  disabled={metricDisabled}
                  onClick={() => setTrainingDone(true)}
                >
                  ✓ Была
                </button>
                <button
                  type="button"
                  className={`${styles.trainingOption} ${
                    metrics.trainingDone === false ? styles.trainingActive : ''
                  }`}
                  disabled={metricDisabled}
                  onClick={() => setTrainingDone(false)}
                >
                  ✗ Не была
                </button>
              </div>
            </label>
          </MetricBlock>

          <MetricBlock>
            <PulseReadingsForm
              className={styles.pulseBlockContent}
              readings={pulseReadings}
              onUpdateReading={updatePulseReading}
              onAddReading={addPulseReading}
              onRemoveReading={removePulseReading}
              readOnly={!isEditable}
            />
          </MetricBlock>
        </div>
      </div>

      {isEditable && (
        <div className={styles.saveBtnDiv}>
          <button
            onClick={() => saveReport(streamId, dayNumber)}
            disabled={saving || !canSave}
            className={styles.saveBtn}
          >
            {saving ? 'Сохранение...' : 'Сохранить отчёт'}
          </button>
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
