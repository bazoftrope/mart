/** Последствия удаления аккаунта — для предупреждения в интерфейсе. */
export interface DeletionImpact {
  role: string;
  /** Шаблоны ментора (у участника — 0). */
  templates: number;
  /** Потоки, запущенные из этих шаблонов. */
  streams: number;
  /** Записи на потоки, которые будут удалены. */
  enrollments: number;
  /** Уникальные участники в потоках ментора. */
  participants: number;
}
