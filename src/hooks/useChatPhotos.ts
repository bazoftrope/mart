import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import type { ChatAttachment } from '@/types/chat';

export const CHAT_MAX_PHOTOS = 5;
export const CHAT_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const CHAT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type PendingChatPhoto = ChatAttachment & { clientKey: string };

type UploadedFileMeta = {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Загрузка фото для чата: выбираем файлы → сразу грузим через
 * POST /api/uploads/image → держим в превью до отправки сообщения.
 */
export function useChatPhotos() {
  const [photos, setPhotos] = useState<PendingChatPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);

      for (const file of files) {
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          setError('Поддерживаются только изображения jpg, png, webp, gif');
          return;
        }
        if (file.size > CHAT_MAX_PHOTO_BYTES) {
          setError('Фото больше 10 МБ');
          return;
        }
      }

      if (photos.length + files.length > CHAT_MAX_PHOTOS) {
        setError(`Можно прикрепить не больше ${CHAT_MAX_PHOTOS} фото`);
        return;
      }

      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        files.forEach((file) => form.append('files', file));

        const res = await apiFetch('/api/uploads/image', {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить фото');
        }

        const uploaded: UploadedFileMeta[] = json.data?.files || [];
        setPhotos((prev) => [
          ...prev,
          ...uploaded.map((file, index) => ({
            url: file.url,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            clientKey: `${file.url}:${index}`,
          })),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
      } finally {
        setUploading(false);
      }
    },
    [photos.length]
  );

  const remove = useCallback((clientKey: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.clientKey !== clientKey));
  }, []);

  const reset = useCallback(() => {
    setPhotos([]);
    setError(null);
  }, []);

  const toAttachments = useCallback(
    (): ChatAttachment[] =>
      photos.map(({ url, fileName, mimeType, sizeBytes }) => ({
        url,
        fileName,
        mimeType,
        sizeBytes,
      })),
    [photos]
  );

  return { photos, uploading, error, addFiles, remove, reset, toAttachments };
}
