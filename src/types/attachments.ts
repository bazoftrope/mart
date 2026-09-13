export type AttachmentKind = 'audio' | 'video' | 'file' | 'image';
export type AttachmentScope = 'intro' | 'day';

export type ContentAttachmentKind = 'file' | 'image' | 'audio' | 'video';
export type ContentAttachmentOwnerType = 'recipe' | 'workout';

export type AttachmentData = {
  id?: string;
  /** Локальный ключ строки для UI до сохранения (сервер его не хранит). */
  clientKey?: string;
  kind: AttachmentKind;
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  position?: number;
  pairId?: string | null;
  description?: string | null;
};

export type AttachmentInput = {
  kind: AttachmentKind;
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  position?: number;
  pairId?: string | null;
  description?: string | null;
};

export type ContentAttachmentData = {
  id?: string;
  /** Локальный ключ строки для UI до сохранения (сервер его не хранит). */
  clientKey?: string;
  kind: ContentAttachmentKind;
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  position?: number;
  pairId?: string | null;
  description?: string | null;
};
