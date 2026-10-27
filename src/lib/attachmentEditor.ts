import type { AttachmentData, AttachmentKind } from '@/types/attachments';

/**
 * Чистая модель редактирования вложений шаблона/дня.
 *
 * Идея: все операции принимают полный массив `attachments` дня и возвращают новый
 * полный массив. Никакой «хирургии» по частям — правила «что удаляется вместе с чем»
 * описаны ровно один раз. React-компонент (`AttachmentsEditor`) только вызывает эти
 * функции, поэтому в нём больше нет условий фильтрации.
 *
 * Строки идентифицируются стабильным ключом (`id` от сервера или локальный `clientKey`
 * до сохранения), а не индексом в массиве.
 */

/**
 * Генерирует UUID v4 в правильном формате.
 * `crypto.randomUUID()` доступен только в secure context (HTTPS/localhost),
 * поэтому на стенде по HTTP используем `getRandomValues` или Math.random.
 * Формат обязателен: `pairId` уходит в UUID-колонку PostgreSQL и в zod-валидацию.
 */
function randomUuidV4(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newAttachmentKey(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // В не-secure context randomUUID может быть недоступен — используем fallback.
  }
  return randomUuidV4();
}

/** Стабильный ключ строки: id с сервера, иначе локальный clientKey. */
export function attachmentKey(attachment: AttachmentData): string {
  return attachment.id ?? attachment.clientKey ?? `${attachment.kind}:${attachment.url}`;
}

/** Проставляет clientKey строкам, пришедшим с сервера (без id у новых строк). */
export function ensureClientKeys(attachments: AttachmentData[]): AttachmentData[] {
  let changed = false;
  const next = attachments.map((attachment) => {
    if (attachment.clientKey) return attachment;
    changed = true;
    return { ...attachment, clientKey: newAttachmentKey() };
  });
  return changed ? next : attachments;
}

export function isMediaKind(kind: AttachmentKind): boolean {
  return kind === 'audio' || kind === 'video';
}

/**
 * Что показывает блок данного kind:
 * - медиа — все свои строки (в том числе с парным PDF);
 * - file/image — только одиночные, без пары.
 */
export function visibleForKind(
  attachments: AttachmentData[],
  kind: AttachmentKind
): AttachmentData[] {
  if (isMediaKind(kind)) {
    return attachments.filter((attachment) => attachment.kind === kind);
  }
  return attachments.filter((attachment) => attachment.kind === kind && !attachment.pairId);
}

/** PDF-документы, привязанные к медиа (строки file с тем же pairId). */
export function pairPdfsFor(
  attachments: AttachmentData[],
  media: AttachmentData
): AttachmentData[] {
  if (!media.pairId) return [];
  return attachments.filter(
    (attachment) => attachment.kind === 'file' && attachment.pairId === media.pairId
  );
}

/** Сквозная нумерация позиций по всему дню (а не отдельно по каждому kind). */
export function reindexPositions(attachments: AttachmentData[]): AttachmentData[] {
  let changed = false;
  const next = attachments.map((attachment, index) => {
    if (attachment.position === index) return attachment;
    changed = true;
    return { ...attachment, position: index };
  });
  return changed ? next : attachments;
}

function findByKey(attachments: AttachmentData[], key: string): AttachmentData | undefined {
  return attachments.find((attachment) => attachmentKey(attachment) === key);
}

/** Добавляет загруженные файлы (audio/video/file/image) в конец списка. */
export function addUploaded(
  attachments: AttachmentData[],
  kind: AttachmentKind,
  files: AttachmentData[]
): AttachmentData[] {
  const added = files.map((file) => ({
    ...file,
    kind,
    pairId: null,
    clientKey: newAttachmentKey(),
  }));
  return reindexPositions([...attachments, ...added]);
}

/** Добавляет видео по ссылке Kinescope (файл не загружается). */
export function addVideo(attachments: AttachmentData[], videoId: string): AttachmentData[] {
  const item: AttachmentData = {
    kind: 'video',
    url: videoId,
    fileName: 'Видео',
    description: null,
    pairId: null,
    clientKey: newAttachmentKey(),
  };
  return reindexPositions([...attachments, item]);
}

/**
 * Удаляет строку по ключу.
 * Если это медиа с парными PDF — удаляет и все PDF (они живут как одно целое).
 */
export function removeAttachment(attachments: AttachmentData[], key: string): AttachmentData[] {
  const target = findByKey(attachments, key);
  if (!target) return attachments;

  const removedKeys = new Set<string>([key]);
  if (isMediaKind(target.kind)) {
    pairPdfsFor(attachments, target).forEach((pdf) => removedKeys.add(attachmentKey(pdf)));
  }

  return reindexPositions(
    attachments.filter((attachment) => !removedKeys.has(attachmentKey(attachment)))
  );
}

/** Меняет описание одной строки, не пересобирая список. */
export function setDescription(
  attachments: AttachmentData[],
  key: string,
  text: string
): AttachmentData[] {
  const description = text ? text.slice(0, 5000) : null;
  return attachments.map((attachment) =>
    attachmentKey(attachment) === key ? { ...attachment, description } : attachment
  );
}

/**
 * Привязывает ещё один PDF к медиа: у всех строк одинаковый pairId.
 * Уже привязанные PDF сохраняются.
 */
export function attachPdf(
  attachments: AttachmentData[],
  mediaKey: string,
  pdf: AttachmentData
): AttachmentData[] {
  const media = findByKey(attachments, mediaKey);
  if (!media) return attachments;

  const pairId = media.pairId ?? newAttachmentKey();

  const withPairId = attachments.map((attachment) =>
    attachmentKey(attachment) === mediaKey ? { ...attachment, pairId } : attachment
  );

  const pdfRow: AttachmentData = {
    ...pdf,
    kind: 'file',
    pairId,
    description: null,
    clientKey: newAttachmentKey(),
  };

  return reindexPositions([...withPairId, pdfRow]);
}

/**
 * Отвязывает один PDF от медиа и удаляет его строку.
 * Остальные PDF комплекта остаются; pairId снимается только когда их больше нет.
 */
export function detachPdf(
  attachments: AttachmentData[],
  mediaKey: string,
  pdfKey: string
): AttachmentData[] {
  const media = findByKey(attachments, mediaKey);
  if (!media) return attachments;

  const remaining = attachments.filter(
    (attachment) => attachmentKey(attachment) !== pdfKey
  );
  const hasRemainingPdfs = pairPdfsFor(remaining, media).length > 0;

  return reindexPositions(
    remaining.map((attachment) =>
      attachmentKey(attachment) === mediaKey
        ? { ...attachment, pairId: hasRemainingPdfs ? media.pairId ?? null : null }
        : attachment
    )
  );
}
