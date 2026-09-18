import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { Goal } from '@db/models/StreamEnrollment';
import styles from './MarathonProgress.module.css';

export type ProgressReport = {
  dayNumber: number;
  totalCalories: number;
  weightKg: number | null;
  filledAt?: string | Date;
};

type MarathonProgressProps = {
  reports: ProgressReport[];
  targetCalories: number | null;
  goal: Goal | null;
  currentDayNumber: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

export default function MarathonProgress({
  reports,
  targetCalories,
  goal,
  currentDayNumber,
  collapsible = true,
  defaultExpanded = true,
}: MarathonProgressProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasAnyReport = reports.length > 0;

  const calorieChartData = useMemo(() => {
    if (currentDayNumber <= 0) return [];
    const map = new Map(reports.map((r) => [r.dayNumber, r]));
    return Array.from({ length: currentDayNumber }, (_, i) => {
      const day = i + 1;
      const r = map.get(day);
      return {
        day,
        calories: r != null ? Number(r.totalCalories) : null,
      };
    });
  }, [reports, currentDayNumber]);

  const weightChartData = useMemo(() => {
    return reports
      .filter((r) => r.weightKg !== null && r.weightKg !== undefined && Number(r.weightKg) > 0)
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((r) => ({
        day: r.dayNumber,
        weightKg: Number(r.weightKg),
      }));
  }, [reports]);

  const hasCalorieData = useMemo(
    () => calorieChartData.some((d) => d.calories !== null),
    [calorieChartData]
  );
  const canShowWeightChart = weightChartData.length >= 1;

  // small preview numbers for collapsed header
  const lastReport = hasAnyReport ? reports[reports.length - 1] : null;
  const lastCalories = lastReport ? Number(lastReport.totalCalories) : null;
  const lastWeight = weightChartData.length ? weightChartData[weightChartData.length - 1].weightKg : null;
  const firstWeight = weightChartData.length ? weightChartData[0].weightKg : null;
  const weightDiff =
    firstWeight !== null && lastWeight !== null ? Number((lastWeight - firstWeight).toFixed(1)) : null;

  const calorieLabel = (() => {
    if (goal === 'gain') return 'Цель (мин.)';
    if (goal === 'lose' || goal === 'maintain') return 'Цель (макс.)';
    return 'Цель';
  })();

  const showBody = !collapsible || expanded;

  return (
    <section className={`${styles.progress} ${!collapsible ? styles.progressEmbedded : ''}`} aria-label="Прогресс марафона">
      {collapsible && (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className={styles.toggleLeft}>
            <span className={styles.toggleTitle}>Мой прогресс</span>
            {!expanded && hasAnyReport && (
              <span className={styles.preview}>
                {lastCalories !== null && <span>{lastCalories.toFixed(0)} ккал</span>}
                {lastCalories !== null && lastWeight !== null && <span className={styles.dot}>·</span>}
                {lastWeight !== null && <span>{lastWeight} кг</span>}
                {weightDiff !== null && weightDiff !== 0 && (
                  <span className={weightDiff < 0 ? styles.diffDown : styles.diffUp}>
                    {weightDiff > 0 ? `+${weightDiff}` : `${weightDiff}`} кг
                  </span>
                )}
              </span>
            )}
            {!expanded && !hasAnyReport && (
              <span className={styles.previewMuted}>Нет данных — заполните отчёт</span>
            )}
          </span>
          <span className={styles.chevron} aria-hidden>
            {expanded ? '▲' : '▼'}
          </span>
        </button>
      )}

      {showBody && (
        <div className={styles.body}>
          {!hasAnyReport ? (
            <p className={styles.empty}>Заполните первый отчёт, чтобы увидеть динамику калорий и веса.</p>
          ) : (
            <>
              <div className={styles.chartsRow}>
                {/* Weight chart */}
                <div className={`${styles.chartBlock} ${styles.chartBlockWeight}`}>
                  <h3 className={styles.chartTitle}>Вес по дням</h3>
                  {!canShowWeightChart ? (
                    <p className={styles.emptySmall}>
                      Укажите вес в отчёте (блок «Вес и охваты» в день замера), чтобы увидеть график.
                    </p>
                  ) : (
                    <div className={styles.chartWrap}>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={weightChartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 12 }}
                            label={{ value: 'День', position: 'insideBottom', offset: -4, fontSize: 12 }}
                            allowDecimals={false}
                          />
                          <YAxis
                            dataKey="weightKg"
                            tick={{ fontSize: 12 }}
                            width={48}
                            domain={[0, 'dataMax + 1']}
                            tickFormatter={(v: number) => `${v}`}
                          />
                          <Tooltip
                            formatter={(value: unknown) => `${Number(value)} кг`}
                            labelFormatter={(label: unknown) => `День ${label}`}
                          />
                          <Bar
                            dataKey="weightKg"
                            name="Вес"
                            fill="var(--chart-diastolic)"
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {canShowWeightChart && firstWeight !== null && lastWeight !== null && (
                    <p className={styles.hint}>
                      {firstWeight} → {lastWeight} кг
                      {weightDiff !== null && weightDiff !== 0 && (
                        <span className={weightDiff < 0 ? styles.diffDown : styles.diffUp}>
                          {' '}
                          ({weightDiff > 0 ? `+${weightDiff}` : `${weightDiff}`} кг)
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Calories chart */}
                <div className={`${styles.chartBlock} ${styles.chartBlockCalories}`}>
                  <h3 className={styles.chartTitle}>Калории по дням</h3>
                  {!hasCalorieData ? (
                    <p className={styles.emptySmall}>Нет данных по калориям.</p>
                  ) : (
                    <div className={styles.chartWrap}>
                      <ResponsiveContainer width="100%" height={260}>
<LineChart data={calorieChartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 12 }}
                            label={{ value: 'День', position: 'insideBottom', offset: -4, fontSize: 12 }}
                            allowDecimals={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            width={48}
                            domain={[0, targetCalories !== null ? targetCalories + 300 : 'auto']}
                          />
                          <Tooltip
                            formatter={(value: unknown) =>
                              value == null ? '—' : `${Number(value).toFixed(0)} ккал`
                            }
                            labelFormatter={(label: unknown) => `День ${label}`}
                          />
                          {targetCalories !== null && (
                            <ReferenceLine
                              y={targetCalories}
                              stroke="var(--chart-fat)"
                              strokeDasharray="6 4"
                              strokeWidth={2}
                              label={{
                                value: `${calorieLabel}: ${targetCalories}`,
                                position: 'insideTopRight',
                                fontSize: 11,
                                fill: 'var(--text-warning)',
                              }}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="calories"
                            name="Калории"
                            stroke="var(--chart-systolic)"
                            strokeWidth={2.2}
                            dot={{ r: 3, strokeWidth: 1.5, fill: 'var(--chart-systolic)' }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {targetCalories !== null && (
                    <p className={styles.hint}>
                      Оранжевый пунктир — ваша норма {targetCalories} ккал ({calorieLabel.toLowerCase()}).
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
