import { useState } from 'react';
import { KCAL_PER_GRAM } from '@/lib/nutritionCalculator';
import Button from '@/components/ui/Button';
import styles from './ProductForm.module.css';

export type ProductFormValues = {
  name: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
};

export type ProductFormPayload = {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type ProductFormProps = {
  initialValues?: Partial<ProductFormValues>;
  submitLabel: string;
  onSubmit: (values: ProductFormPayload) => Promise<void>;
  onCancel: () => void;
};

const EMPTY: ProductFormValues = {
  name: '',
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
};

function toField(value: number | string | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function parseMacro(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function suggestCalories(protein: string, fat: string, carbs: string): string {
  const kcal =
    parseMacro(protein) * KCAL_PER_GRAM.protein +
    parseMacro(fat) * KCAL_PER_GRAM.fat +
    parseMacro(carbs) * KCAL_PER_GRAM.carbs;
  return kcal > 0 ? String(Math.round(kcal)) : '';
}

export default function ProductForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY,
    ...initialValues,
    name: toField(initialValues?.name),
    calories: toField(initialValues?.calories),
    protein: toField(initialValues?.protein),
    fat: toField(initialValues?.fat),
    carbs: toField(initialValues?.carbs),
  });
  const [caloriesTouched, setCaloriesTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(field: keyof ProductFormValues, value: string) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (
        !caloriesTouched &&
        (field === 'protein' || field === 'fat' || field === 'carbs')
      ) {
        next.calories = suggestCalories(next.protein, next.fat, next.carbs);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = values.name.trim();
    const calories = Number(values.calories);
    const protein = Number(values.protein || 0);
    const fat = Number(values.fat || 0);
    const carbs = Number(values.carbs || 0);

    if (!name) {
      setError('Укажите название продукта');
      return;
    }
    if (!Number.isFinite(calories) || calories <= 0) {
      setError('Калорийность должна быть больше 0');
      return;
    }
    const macrosValid =
      [protein, fat, carbs].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 100
      ) && protein + fat + carbs <= 100;
    if (!macrosValid) {
      setError('БЖУ: числа от 0 до 100, сумма Б+Ж+У не больше 100');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, calories, protein, fat, carbs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить продукт');
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Название</span>
        <input
          type="text"
          className="input"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          maxLength={200}
          placeholder="Например, Борщ"
        />
      </label>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>ккал/100г</span>
          <input
            type="number"
            min="0.1"
            max="2000"
            step="0.1"
            className="input"
            value={values.calories}
            onChange={(e) => {
              setField('calories', e.target.value);
              setCaloriesTouched(true);
            }}
          />
        </label>
        <label className={styles.field}>
          <span>Белки, г/100г</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="input"
            value={values.protein}
            onChange={(e) => setField('protein', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Жиры, г/100г</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="input"
            value={values.fat}
            onChange={(e) => setField('fat', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Углеводы, г/100г</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="input"
            value={values.carbs}
            onChange={(e) => setField('carbs', e.target.value)}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={submitting}>
          {submitting ? 'Сохранение...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
