import { X } from 'lucide-react';
import type { ChatAttachment } from '@/types/chat';
import type { PendingChatPhoto } from '@/hooks/useChatPhotos';
import styles from './ChatAttachments.module.css';

type PhotoPreviewsProps = {
  photos: PendingChatPhoto[];
  onRemove: (clientKey: string) => void;
  disabled?: boolean;
};

export function PhotoPreviews({ photos, onRemove, disabled = false }: PhotoPreviewsProps) {
  if (photos.length === 0) return null;

  return (
    <div className={styles.previews}>
      {photos.map((photo) => (
        <div key={photo.clientKey} className={styles.previewItem}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.fileName || 'Фото'}
            className={styles.previewThumb}
          />
          <button
            type="button"
            className={styles.previewRemove}
            onClick={() => onRemove(photo.clientKey)}
            disabled={disabled}
            aria-label="Убрать фото"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

type MessageImagesProps = {
  attachments: ChatAttachment[];
};

export function MessageImages({ attachments }: MessageImagesProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={styles.images}>
      {attachments.map((attachment) => (
        <a
          key={attachment.url}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className={styles.imageLink}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.fileName || 'Фото'}
            className={styles.image}
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
