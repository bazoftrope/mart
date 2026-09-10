export type Recipe = {
  id: string;
  title: string;
  description: string | null;
  ingredients: string;
  steps: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  canEdit: boolean;
};

export type RecipeListResponse = {
  items: Recipe[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
