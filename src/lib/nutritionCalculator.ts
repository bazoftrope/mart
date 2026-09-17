/**
 * Расчёт БЖУ и калорийности продуктов и строк отчёта.
 *
 * Продукты хранят Б/Ж/У на 100 г. Строка отчёта хранит уже посчитанные
 * значения с учётом веса (денормализация — как `line_calories`), чтобы
 * правка продукта не меняла историю.
 *
 * Проценты БЖУ считаются по калориям (белки 4, жиры 9, углеводы 4 ккал/г)
 * и всегда дают ровно 100%.
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_ORDER: MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

export type MacroValues = {
  protein: number;
  fat: number;
  carbs: number;
};

export type MacroPercents = {
  protein: number;
  fat: number;
  carbs: number;
};

/** Энергетическая ценность макронутриентов, ккал/г. */
export const KCAL_PER_GRAM: MacroValues = {
  protein: 4,
  fat: 9,
  carbs: 4,
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Калории строки: вес (г) × ккал/100 г. */
export function computeLineCalories(
  weightGrams: number,
  caloriesPer100: number
): number {
  return round2((weightGrams * caloriesPer100) / 100);
}

/** Макронутриент строки: вес (г) × г/100 г. */
export function computeLineMacro(
  weightGrams: number,
  macroPer100: number
): number {
  return round2((weightGrams * macroPer100) / 100);
}

/** Калории, приходящиеся на Б/Ж/У. */
export function computeCalories(proteinG: number, fatG: number, carbsG: number): number {
  return round2(
    proteinG * KCAL_PER_GRAM.protein +
      fatG * KCAL_PER_GRAM.fat +
      carbsG * KCAL_PER_GRAM.carbs
  );
}

/**
 * Пропорции БЖУ в процентах по калориям.
 * Возвращает целые проценты, сумма которых ровно 100 (метод наибольших остатков),
 * либо `null`, если макронутриентов нет.
 */
export function calcMacroPercents(
  proteinG: number,
  fatG: number,
  carbsG: number
): MacroPercents | null {
  const energy: MacroValues = {
    protein: proteinG * KCAL_PER_GRAM.protein,
    fat: fatG * KCAL_PER_GRAM.fat,
    carbs: carbsG * KCAL_PER_GRAM.carbs,
  };
  const total = energy.protein + energy.fat + energy.carbs;
  if (!Number.isFinite(total) || total <= 0) return null;

  const keys: Array<keyof MacroValues> = ['protein', 'fat', 'carbs'];
  const exact = keys.map((key) => (energy[key] / total) * 100);
  const result = keys.map((_, i) => Math.floor(exact[i]));

  let remainder = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    result[order[i].index] += 1;
    remainder -= 1;
  }

  return {
    protein: result[0],
    fat: result[1],
    carbs: result[2],
  };
}

/** Приём пищи по умолчанию — по текущему времени суток. */
export function defaultMealForNow(date: Date = new Date()): MealType {
  const hours = date.getHours();
  if (hours < 11) return 'breakfast';
  if (hours < 16) return 'lunch';
  if (hours < 22) return 'dinner';
  return 'snack';
}
