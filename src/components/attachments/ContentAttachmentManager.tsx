import { useMemo, useState } from 'react';
import type { AttachmentData, ContentAttachmentData } from '@/types/attachments';
import { apiFetch } from '@/lib/apiClient';
import { normalizeKinescopeVideoId } from '@/lib/kinescope';
import KinescopePlayer from '@/components/day/KinescopePlayer';
import {
  addUploaded,
  addVideo,
  attachmentKey,
  ensureClientKeys,
  removeAttachment,
  visibleForKind,
} from '@/lib/attachmentEditor';
import styles from './ContentAttachmentManager.module.css';

type ContentAttachmentKind = 'file' | 'image' | 'video';

type ContentAttachmentManagerProps = {
  kind: ContentAttachmentKind;
  label: string;
  attachments: ContentAttachmentData[];
  onChange: (next: ContentAttachmentData[]) => void;
  disabled?: boolean;
};

const ACCEPT: Record<ContentAttachmentKind, string> = {
  file: 'application/pdf',
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: '',
};

const ENDPOINT: Record<ContentAttachmentKind, string> = {
  file: '/api/uploads/content/file',
  image: '/api/uploads/image',
  video: '',
};

type UploadedMeta = {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Редактор вложений контента (рецепты/тренировки): изображения, PDF и видео
 * по ссылке Kinescope. Логика работы со списком — общая с материалами шаблона
 * (`src/lib/attachmentEditor.ts`), здесь только UI и сетевые вызовы.
 */
export default function ContentAttachmentManager({
  kind,
  label,
  attachments,
  onChange,
  disabled = false,
}: ContentAttachmentManagerProps) {
  const rows = useMemo(() => ensureClientKeys(attachments), [attachments]);

  const [uploading, setUploading] = useState(false);
  const [videoInput, setVideoInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isVideo = kind === 'video';
  const items = visibleForKind(rows as AttachmentData[], kind);

  async function handleFiles(input: HTMLInputElement) {
    const fileList = input.files;
    if (!fileList || fileList.length === 0 || disabled) return;

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      Array.from(fileList).forEach((file) => form.append('files', file));

      const res = await apiFetch(ENDPOINT[kind], {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось загрузить файл');
      }

      const uploaded: AttachmentData[] = ((json.data?.files || []) as UploadedMeta[]).map(
        (file) => ({
          kind,
          url: file.url,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          description: null,
          pairId: null,
        })
      );

      onChange(addUploaded(rows as AttachmentData[], kind, uploaded));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setUploading(false);
      input.value = '';
    }
  }

  function handleAddVideo() {
    if (disabled) return;

    const videoId = normalizeKinescopeVideoId(videoInput);
    if (!videoId) {
      setError('Вставьте корректную ссылку Kinescope (https://kinescope.io/...)');
      return;
    }

    setError(null);
    onChange(addVideo(rows as AttachmentData[], videoId));
    setVideoInput('');
  }

  function handleRemove(key: string) {
    if (disabled) return;
    onChange(removeAttachment(rows as AttachmentData[], key));
  }

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.count}>{items.length}</span>
      </div>

      {items.length === 0 && <p className={styles.empty}>Пока пусто.</p>}

      {items.length > 0 && (
        <div className={styles.list}>
          {items.map((attachment) => {
            const key = attachmentKey(attachment);

            return (
              <div key={key} className={kind === 'image' ? styles.imageCard : styles.item}>
                {kind === 'image' && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.url}
                      alt={attachment.fileName || 'Изображение'}
                      className={styles.thumb}
                    />
                    <span className={styles.fileName}>
                      {attachment.fileName || 'Изображение'}
                    </span>
                  </>
                )}

                {kind === 'file' && (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.fileLink}
                  >
                    {attachment.fileName || 'Открыть PDF'}
                  </a>
                )}

                {kind === 'video' && (
                  <div className={styles.videoPreview}>
                    <KinescopePlayer
                      videoId={normalizeKinescopeVideoId(attachment.url) || attachment.url}
                      title={attachment.fileName || 'Видео'}
                    />
                  </div>
                )}

                {!disabled && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => handleRemove(key)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <div className={styles.controls}>
          {isVideo ? (
            <div className={styles.videoAddRow}>
              <input
                type="text"
                className={styles.videoInput}
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="https://kinescope.io/..."
              />
              <button type="button" className={styles.addButton} onClick={handleAddVideo}>
                Добавить
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept={ACCEPT[kind]}
                multiple
                disabled={uploading}
                onChange={(e) => void handleFiles(e.target)}
                className={styles.fileInput}
              />
              {uploading && <span className={styles.hint}>Загрузка...</span>}
            </>
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
