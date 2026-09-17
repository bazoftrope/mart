import type { Product } from '@db/models/Product';

/** Единый DTO продукта для API (ккал и Б/Ж/У на 100 г). */
export function serializeProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    calories: Number(product.calories),
    protein: Number(product.protein),
    fat: Number(product.fat),
    carbs: Number(product.carbs),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export type SerializedProduct = ReturnType<typeof serializeProduct>;
