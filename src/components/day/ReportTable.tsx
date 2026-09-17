import { Icon } from '@/components/icons';
import Button from '@/components/ui/Button';
import styles from './ReportTable.module.css';
import {
  MEAL_LABELS,
  MEAL_ORDER,
  computeLineCalories,
  computeLineMacro,
  type MealType,
} from '@/lib/nutritionCalculator';

export type ReportLineItem = {
  id?: string;
  productId: string;
  name: string;
  /** ккал на 100 г */
  calories: number;
  /** белки, г на 100 г */
  protein: number;
  /** жиры, г на 100 г */
  fat: number;
  /** углеводы, г на 100 г */
  carbs: number;
  mealType: MealType;
  weightGrams: number;
  lineCalories: number;
  lineProtein: number;
  lineFat: number;
  lineCarbs: number;
};

type ReportTableProps = {
  lines: ReportLineItem[];
  onChange?: (lines: ReportLineItem[]) => void;
  onUpdateLine?: (index: number, weightGrams: number) => void;
  onRemoveLine?: (index: number) => void;
  readOnly?: boolean;
};

function formatMacro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function ReportTable({
  lines,
  onChange,
  onUpdateLine,
  onRemoveLine,
  readOnly,
}: ReportTableProps) {
  function updateWeight(index: number, value: string) {
    const weight = parseFloat(value);
    if (Number.isNaN(weight) || weight <= 0) return;

    if (onUpdateLine) {
      onUpdateLine(index, weight);
      return;
    }

    const next = lines.map((line, i) => {
      if (i !== index) return line;
      return {
        ...line,
        weightGrams: weight,
        lineCalories: computeLineCalories(weight, line.calories),
        lineProtein: computeLineMacro(weight, line.protein),
        lineFat: computeLineMacro(weight, line.fat),
        lineCarbs: computeLineMacro(weight, line.carbs),
      };
    });
    onChange?.(next);
  }

  function removeLine(index: number) {
    if (onRemoveLine) {
      onRemoveLine(index);
      return;
    }
    onChange?.(lines.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.meals}>
      {MEAL_ORDER.map((meal) => {
        const mealLines = lines
          .map((line, index) => ({ line, index }))
          .filter((item) => item.line.mealType === meal);

        const totals = mealLines.reduce(
          (acc, item) => ({
            calories: acc.calories + item.line.lineCalories,
            protein: acc.protein + item.line.lineProtein,
            fat: acc.fat + item.line.lineFat,
            carbs: acc.carbs + item.line.lineCarbs,
          }),
          { calories: 0, protein: 0, fat: 0, carbs: 0 }
        );

        return (
          <section key={meal} className={styles.mealBlock}>
            <div className={styles.mealHeader}>
              <h4 className={styles.mealTitle}>{MEAL_LABELS[meal]}</h4>
              {mealLines.length > 0 ? (
                <span className={styles.mealSubtotal}>
                  {Math.round(totals.calories)} ккал · Б {formatMacro(totals.protein)} · Ж{' '}
                  {formatMacro(totals.fat)} · У {formatMacro(totals.carbs)}
                </span>
              ) : (
                <span className={styles.mealEmpty}>Ничего не добавлено</span>
              )}
            </div>

            {mealLines.length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr className={styles.headerRow}>
                    <th className={styles.th}>Продукт</th>
                    <th className={styles.th}>Вес (г)</th>
                    <th className={styles.th}>ккал</th>
                    <th className={styles.th}>Б</th>
                    <th className={styles.th}>Ж</th>
                    <th className={styles.th}>У</th>
                    {!readOnly && <th className={`${styles.th} ${styles.thAction}`}></th>}
                  </tr>
                </thead>
                <tbody>
                  {mealLines.map(({ line, index }) => (
                    <tr key={`${line.productId}-${index}`}>
                      <td className={styles.td}>
                        <span className={styles.productName}>{line.name}</span>
                        <span className={styles.productMeta}>
                          {line.calories} ккал/100г · Б {formatMacro(line.protein)} · Ж{' '}
                          {formatMacro(line.fat)} · У {formatMacro(line.carbs)}
                        </span>
                      </td>
                      <td className={styles.td}>
                        {readOnly ? (
                          line.weightGrams
                        ) : (
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={line.weightGrams}
                            onChange={(e) => updateWeight(index, e.target.value)}
                            className={styles.input}
                          />
                        )}
                      </td>
                      <td className={styles.td}>{line.lineCalories.toFixed(2)}</td>
                      <td className={styles.td}>{formatMacro(line.lineProtein)}</td>
                      <td className={styles.td}>{formatMacro(line.lineFat)}</td>
                      <td className={styles.td}>{formatMacro(line.lineCarbs)}</td>
                      {!readOnly && (
                        <td className={`${styles.td} ${styles.tdAction}`}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={styles.deleteBtn}
                            onClick={() => removeLine(index)}
                            aria-label="Удалить продукт"
                          >
                            <Icon name="del" width={16} height={16} aria-hidden="true" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
