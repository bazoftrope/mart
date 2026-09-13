import styles from './ReportTable.module.css';

export type ReportLineItem = {
  id?: string;
  productId: string;
  name: string;
  calories: number;
  weightGrams: number;
  lineCalories: number;
};

type ReportTableProps = {
  lines: ReportLineItem[];
  onChange?: (lines: ReportLineItem[]) => void;
  onUpdateLine?: (index: number, weightGrams: number) => void;
  onRemoveLine?: (index: number) => void;
  readOnly?: boolean;
  headerStatus?: 'ok' | 'over';
};

export function computeLineCalories(
  weightGrams: number,
  calories: number
): number {
  return Math.round(weightGrams * calories) / 100;
}

export default function ReportTable({
  lines,
  onChange,
  onUpdateLine,
  onRemoveLine,
  readOnly,
  headerStatus,
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

  const headerClass =
    headerStatus === 'over'
      ? styles.headerOver
      : headerStatus === 'ok'
        ? styles.headerOk
        : '';

  return (
    <div>
      {lines.length === 0 ? (
        <p className={styles.emptyText}>Продукты ещё не добавлены.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr className={`${styles.headerRow} ${headerClass}`}>
              <th className={styles.th}>Продукт</th>
              <th className={styles.th}>ккал/100г</th>
              <th className={styles.th}>Вес (г)</th>
              <th className={styles.th}>ккал</th>
              {!readOnly && <th className={styles.th}></th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.productId}-${index}`}>
                <td className={styles.td}>{line.name}</td>
                <td className={styles.td}>{line.calories}</td>
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
                {!readOnly && (
                  <td className={styles.td}>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className={styles.removeButton}
                    >
                      Удалить
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
