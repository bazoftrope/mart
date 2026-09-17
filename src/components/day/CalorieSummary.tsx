import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { GOAL_LABELS } from '@/lib/calorieCalculator';
import { calcMacroPercents, type MacroValues } from '@/lib/nutritionCalculator';
import type { Goal } from '@/types/participantDay';
import styles from './CalorieSummary.module.css';

type CalorieSummaryProps = {
  targetCalories: number | null;
  actualCalories: number;
  macros: MacroValues;
  goal: Goal | null;
  isTargetMissed: boolean;
  profileCompleted: boolean;
};

const MACRO_COLORS = {
  protein: 'var(--chart-protein)',
  fat: 'var(--chart-fat)',
  carbs: 'var(--chart-carbs)',
} as const;

function formatGrams(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default function CalorieSummary({
  targetCalories,
  actualCalories,
  macros,
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

  const percents = calcMacroPercents(macros.protein, macros.fat, macros.carbs);
  const ringData = percents
    ? [
        {
          key: 'protein',
          name: 'Белки',
          value: percents.protein,
          grams: macros.protein,
          color: MACRO_COLORS.protein,
        },
        {
          key: 'fat',
          name: 'Жиры',
          value: percents.fat,
          grams: macros.fat,
          color: MACRO_COLORS.fat,
        },
        {
          key: 'carbs',
          name: 'Углеводы',
          value: percents.carbs,
          grams: macros.carbs,
          color: MACRO_COLORS.carbs,
        },
      ]
    : [];

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

      <div className={styles.macroBlock}>
        <span className={styles.macroTitle}>БЖУ отчёта</span>
        {percents ? (
          <div className={styles.macroContent}>
            <div className={styles.macroRing}>
              <ResponsiveContainer width={132} height={132}>
                <PieChart>
                  <Pie
                    data={ringData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={62}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {ringData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      `${value}%`,
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.macroRingCenter} aria-hidden>
                <span className={styles.macroRingValue}>{Math.round(actualCalories)}</span>
                <span className={styles.macroRingUnit}>ккал</span>
              </div>
            </div>

            <ul className={styles.macroLegend}>
              {ringData.map((entry) => (
                <li key={entry.key} className={styles.macroLegendItem}>
                  <span
                    className={styles.macroDot}
                    style={{ background: entry.color }}
                    aria-hidden
                  />
                  <span className={styles.macroLegendLabel}>{entry.name}</span>
                  <span className={styles.macroLegendValue}>{entry.value}%</span>
                  <span className={styles.macroLegendGrams}>
                    {formatGrams(entry.grams)} г
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.macroEmpty}>
            Добавьте продукты, чтобы увидеть пропорции БЖУ.
          </p>
        )}
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
