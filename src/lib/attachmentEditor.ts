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

let fallbackCounter = 0;

export function newAttachmentKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `local-${Date.now()}-${fallbackCounter}`;
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

/** PDF, привязанный к медиа (строка file с тем же pairId). */
export function pairPdfFor(
  attachments: AttachmentData[],
  media: AttachmentData
): AttachmentData | undefined {
  if (!media.pairId) return undefined;
  return attachments.find(
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
 * Если это медиа с парным PDF — удаляет и PDF (они живут как одно целое).
 */
export function removeAttachment(attachments: AttachmentData[], key: string): AttachmentData[] {
  const target = findByKey(attachments, key);
  if (!target) return attachments;

  const removedKeys = new Set<string>([key]);
  if (isMediaKind(target.kind)) {
    const pdf = pairPdfFor(attachments, target);
    if (pdf) removedKeys.add(attachmentKey(pdf));
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
 * Привязывает PDF к медиа: у обеих строк одинаковый pairId.
 * Если у медиа уже был PDF — он заменяется новым.
 */
export function attachPdf(
  attachments: AttachmentData[],
  mediaKey: string,
  pdf: AttachmentData
): AttachmentData[] {
  const media = findByKey(attachments, mediaKey);
  if (!media) return attachments;

  const previousPdf = pairPdfFor(attachments, media);
  const pairId = media.pairId ?? newAttachmentKey();

  const withoutPrevious = previousPdf
    ? attachments.filter((attachment) => attachmentKey(attachment) !== attachmentKey(previousPdf))
    : attachments;

  const withPairId = withoutPrevious.map((attachment) =>
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

/** Отвязывает PDF от медиа и удаляет строку PDF. */
export function detachPdf(attachments: AttachmentData[], mediaKey: string): AttachmentData[] {
  const media = findByKey(attachments, mediaKey);
  if (!media) return attachments;

  const pdf = pairPdfFor(attachments, media);
  const pdfKey = pdf ? attachmentKey(pdf) : null;

  return reindexPositions(
    attachments
      .filter((attachment) => (pdfKey ? attachmentKey(attachment) !== pdfKey : true))
      .map((attachment) =>
        attachmentKey(attachment) === mediaKey ? { ...attachment, pairId: null } : attachment
      )
  );
}
