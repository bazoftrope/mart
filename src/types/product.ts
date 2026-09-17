export type ProductDto = {
  id: string;
  name: string;
  /** ккал на 100 г */
  calories: number;
  /** белки, г на 100 г */
  protein: number;
  /** жиры, г на 100 г */
  fat: number;
  /** углеводы, г на 100 г */
  carbs: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductListResponse = {
  items: ProductDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
