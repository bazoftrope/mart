import type { ContentAttachmentData } from './attachments';

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
  attachments: ContentAttachmentData[];
};

export type WorkoutListResponse = {
  items: Workout[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
