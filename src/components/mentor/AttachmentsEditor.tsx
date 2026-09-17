import { useMemo, useState } from 'react';
import type { AttachmentData, AttachmentKind } from '@/types/attachments';
import { apiFetch } from '@/lib/apiClient';
import { normalizeKinescopeVideoId } from '@/lib/kinescope';
import Button from '@/components/ui/Button';
import KinescopePlayer from '@/components/day/KinescopePlayer';
import {
  addUploaded,
  addVideo,
  attachmentKey,
  attachPdf,
  detachPdf,
  ensureClientKeys,
  isMediaKind,
  pairPdfFor,
  removeAttachment,
  setDescription,
  visibleForKind,
} from '@/lib/attachmentEditor';
import styles from './AttachmentsEditor.module.css';

const SECTION_LABELS: Record<AttachmentKind, string> = {
  image: 'Изображения (галерея)',
  file: 'Документы (PDF) — независимые',
  audio: 'Аудио (с описанием и PDF опционально)',
  video: 'Видео (с описанием и PDF опционально)',
};

const ACCEPT: Record<AttachmentKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  file: 'application/pdf',
  audio: 'audio/*',
  video: '',
};

const UPLOAD_ENDPOINT: Record<AttachmentKind, string> = {
  image: '/api/uploads/image',
  file: '/api/uploads/file',
  audio: '/api/uploads/audio',
  video: '',
};

type UploadedMeta = {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type SectionError = {
  kind: AttachmentKind;
  message: string;
};

type AttachmentsEditorProps = {
  templateId: string;
  /** Какие секции показать и в каком порядке. */
  kinds: AttachmentKind[];
  attachments: AttachmentData[];
  onChange: (next: AttachmentData[]) => void;
  disabled?: boolean;
};

/**
 * Единственный редактор вложений на день/шаблон.
 * Рисует те же секции, что раньше рисовали четыре отдельных `AttachmentManager`,
 * но состояние дня и правила комплектов «PDF + медиа» живут в одном месте
 * (чистые функции в `src/lib/attachmentEditor.ts`).
 */
export default function AttachmentsEditor({
  templateId,
  kinds,
  attachments,
  onChange,
  disabled = false,
}: AttachmentsEditorProps) {
  const rows = useMemo(() => ensureClientKeys(attachments), [attachments]);

  const [uploading, setUploading] = useState<string | null>(null);
  const [videoInput, setVideoInput] = useState('');
  const [error, setError] = useState<SectionError | null>(null);

  async function handleUpload(kind: AttachmentKind, input: HTMLInputElement) {
    const fileList = input.files;
    if (!fileList || fileList.length === 0 || disabled) return;

    setUploading(`upload:${kind}`);
    setError(null);

    try {
      const form = new FormData();
      form.append('templateId', templateId);
      Array.from(fileList).forEach((file) => form.append('files', file));

      const res = await apiFetch(UPLOAD_ENDPOINT[kind], {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось загрузить файл');
      }

      const uploaded: AttachmentData[] = ((json.data?.files || []) as UploadedMeta[]).map((file) => ({
        kind,
        url: file.url,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        description: null,
        pairId: null,
      }));

      onChange(addUploaded(rows, kind, uploaded));
    } catch (err) {
      setError({ kind, message: err instanceof Error ? err.message : 'Что-то пошло не так' });
    } finally {
      setUploading(null);
      input.value = '';
    }
  }

  function handleAddVideo() {
    if (disabled) return;

    const videoId = normalizeKinescopeVideoId(videoInput);
    if (!videoId) {
      setError({
        kind: 'video',
        message: 'Вставьте корректную ссылку Kinescope (https://kinescope.io/...)',
      });
      return;
    }

    setError(null);
    onChange(addVideo(rows, videoId));
    setVideoInput('');
  }

  function handleRemove(key: string) {
    if (disabled) return;
    onChange(removeAttachment(rows, key));
  }

  function handleDescription(key: string, value: string) {
    if (disabled) return;
    onChange(setDescription(rows, key, value));
  }

  async function handleAttachPdf(mediaKey: string, kind: AttachmentKind, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file || disabled) return;

    setUploading(`pdf:${mediaKey}`);
    setError(null);

    try {
      const form = new FormData();
      form.append('templateId', templateId);
      form.append('files', file);

      const res = await apiFetch('/api/uploads/file', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось загрузить PDF');
      }

      const uploaded = json.data?.files?.[0] as UploadedMeta | undefined;
      if (!uploaded) throw new Error('Файл не загружен');

      const pdf: AttachmentData = {
        kind: 'file',
        url: uploaded.url,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        description: null,
        pairId: null,
      };

      onChange(attachPdf(rows, mediaKey, pdf));
    } catch (err) {
      setError({
        kind,
        message: err instanceof Error ? err.message : 'Что-то пошло не так',
      });
    } finally {
      setUploading(null);
      input.value = '';
    }
  }

  function handleDetachPdf(mediaKey: string) {
    if (disabled) return;
    onChange(detachPdf(rows, mediaKey));
  }

  return (
    <>
      {kinds.map((kind) => {
        const isMedia = isMediaKind(kind);
        const items = visibleForKind(rows, kind);
        const sectionError = error && error.kind === kind ? error.message : null;

        return (
          <div key={kind} className={styles.block}>
            <div className={styles.header}>
              <span className={styles.label}>{SECTION_LABELS[kind]}</span>
              <span className={styles.count}>{items.length}</span>
            </div>

            {items.length === 0 && <p className={styles.empty}>Пока пусто.</p>}

            {items.map((attachment) => {
              const key = attachmentKey(attachment);
              const pdf = isMedia ? pairPdfFor(rows, attachment) : undefined;

              return (
                <div key={key} className={isMedia ? styles.mediaCard : styles.item}>
                  {kind === 'audio' && (
                    <div className={styles.mediaMain}>
                      {attachment.fileName && (
                        <span className={styles.fileName}>{attachment.fileName}</span>
                      )}
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio
                        controls
                        preload="metadata"
                        className={styles.audio}
                        src={attachment.url}
                      />
                    </div>
                  )}

                  {kind === 'video' && (
                    <div className={styles.mediaMain}>
                      <div className={styles.videoPreview}>
                        <KinescopePlayer
                          videoId={normalizeKinescopeVideoId(attachment.url) || attachment.url}
                          title={attachment.fileName || 'Видео'}
                        />
                      </div>
                      {attachment.fileName && attachment.fileName !== 'Видео' && (
                        <span className={styles.fileName}>{attachment.fileName}</span>
                      )}
                    </div>
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

                  {kind === 'image' && (
                    <div className={styles.mediaMain}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={attachment.url}
                        alt={attachment.fileName || 'Изображение'}
                        className={styles.imagePreview}
                        loading="lazy"
                      />
                      {attachment.fileName && (
                        <span className={styles.fileName}>{attachment.fileName}</span>
                      )}
                    </div>
                  )}

                  {isMedia && (
                    <div className={styles.mediaExtras}>
                      <label className={styles.descriptionLabel}>
                        <span className={styles.descriptionCaption}>Описание (необязательно)</span>
                        <textarea
                          className={styles.descriptionInput}
                          value={attachment.description || ''}
                          onChange={(e) => handleDescription(key, e.target.value)}
                          disabled={disabled}
                          placeholder={
                            kind === 'video' ? 'Краткое описание видео...' : 'Описание аудио...'
                          }
                          rows={2}
                          maxLength={5000}
                        />
                      </label>

                      <div className={styles.pdfRow}>
                        {pdf ? (
                          <>
                            <a
                              href={pdf.url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.fileLink}
                            >
                              {pdf.fileName || 'Открыть PDF'}
                            </a>
                            {!disabled && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDetachPdf(key)}
                              >
                                Удалить PDF
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <label className={styles.pdfLabel} htmlFor={`pdf-input-${key}`}>
                              PDF (необязательно)
                            </label>
                            {!disabled && (
                              <input
                                id={`pdf-input-${key}`}
                                type="file"
                                accept="application/pdf"
                                disabled={uploading === `pdf:${key}`}
                                onChange={(e) => void handleAttachPdf(key, kind, e.target)}
                                className={styles.fileInput}
                              />
                            )}
                            {uploading === `pdf:${key}` && (
                              <span className={styles.hint}>Загрузка PDF...</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(key)}
                    >
                      Удалить {isMedia ? (kind === 'video' ? 'видео' : 'аудио') : ''}
                    </Button>
                  )}
                </div>
              );
            })}

            {!disabled && (
              <div className={styles.controls}>
                {kind === 'video' ? (
                  <div className={styles.videoAddRow}>
                    <input
                      type="text"
                      className={styles.videoInput}
                      value={videoInput}
                      onChange={(e) => setVideoInput(e.target.value)}
                      placeholder="https://kinescope.io/..."
                    />
                    <Button type="button" variant="primary" size="sm" onClick={handleAddVideo}>
                      Добавить
                    </Button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept={ACCEPT[kind]}
                      multiple
                      disabled={uploading === `upload:${kind}`}
                      onChange={(e) => void handleUpload(kind, e.target)}
                      className={styles.fileInput}
                    />
                    {uploading === `upload:${kind}` && <span className={styles.hint}>Загрузка...</span>}
                  </>
                )}
              </div>
            )}

            {sectionError && <p className={styles.error}>{sectionError}</p>}
          </div>
        );
      })}
    </>
  );
}
