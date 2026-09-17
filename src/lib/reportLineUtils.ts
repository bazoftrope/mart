import type { Product } from '@db/models/Product';
import type { MealType, ReportLine } from '@db/models/ReportLine';
import { BadRequest } from '@/lib/errors';
import {
  computeLineCalories,
  computeLineMacro,
  round2,
} from '@/lib/nutritionCalculator';

export type ReportLinePayload = {
  productId: string;
  mealType: MealType;
  weightGrams: number;
};

export type ReportLineRecord = {
  productId: string;
  mealType: MealType;
  weightGrams: number;
  lineCalories: number;
  lineProtein: number;
  lineFat: number;
  lineCarbs: number;
};

/**
 * Считает по каждой строке калории и Б/Ж/У с учётом веса.
 * Кидает `BadRequest`, если продукт не найден.
 */
export function buildReportLineRecords(
  lines: ReportLinePayload[],
  productMap: Map<string, Product>
): { records: ReportLineRecord[]; totalCalories: number } {
  let totalCalories = 0;

  const records = lines.map((line) => {
    const product = productMap.get(line.productId);
    if (!product) {
      throw new BadRequest(`Product ${line.productId} not found`);
    }

    const lineCalories = computeLineCalories(
      line.weightGrams,
      Number(product.calories)
    );
    totalCalories += lineCalories;

    return {
      productId: line.productId,
      mealType: line.mealType,
      weightGrams: line.weightGrams,
      lineCalories,
      lineProtein: computeLineMacro(line.weightGrams, Number(product.protein)),
      lineFat: computeLineMacro(line.weightGrams, Number(product.fat)),
      lineCarbs: computeLineMacro(line.weightGrams, Number(product.carbs)),
    };
  });

  return { records, totalCalories: round2(totalCalories) };
}

/** DTO строки отчёта: продукт (на 100 г) + значения строки (с учётом веса). */
export function serializeReportLine(
  line: ReportLine,
  product?: Product
): {
  id: string;
  productId: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  mealType: MealType;
  weightGrams: number;
  lineCalories: number;
  lineProtein: number;
  lineFat: number;
  lineCarbs: number;
} {
  return {
    id: line.id,
    productId: line.productId,
    name: product?.name ?? 'Unknown product',
    calories: Number(product?.calories ?? 0),
    protein: Number(product?.protein ?? 0),
    fat: Number(product?.fat ?? 0),
    carbs: Number(product?.carbs ?? 0),
    mealType: line.mealType,
    weightGrams: Number(line.weightGrams),
    lineCalories: Number(line.lineCalories),
    lineProtein: Number(line.lineProtein),
    lineFat: Number(line.lineFat),
    lineCarbs: Number(line.lineCarbs),
  };
}
