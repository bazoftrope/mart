export type Workout = {
  id: string;
  title: string;
  description: string | null;
  exercises: string;
  execution: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  canEdit: boolean;
};

export type WorkoutListResponse = {
  items: Workout[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
