import type { AttachmentData } from '@/types/attachments';

export type AttachmentPairGroup = {
  pairId: string;
  pdf?: AttachmentData;
  audio?: AttachmentData;
  video?: AttachmentData;
};

/**
 * Группирует строки с одинаковым `pairId` в комплекты «медиа + PDF».
 * Комплекты сортируются по минимальной позиции входящих строк.
 */
export function groupMediaAttachments(
  attachments: AttachmentData[],
): AttachmentPairGroup[] {
  const rowsByPairId = new Map<string, AttachmentData[]>();

  for (const attachment of attachments) {
    if (!attachment.pairId) continue;
    const rows = rowsByPairId.get(attachment.pairId) ?? [];
    rows.push(attachment);
    rowsByPairId.set(attachment.pairId, rows);
  }

  const groups: AttachmentPairGroup[] = [];
  Array.from(rowsByPairId.entries()).forEach(([pairId, rows]) => {
    groups.push({
      pairId,
      pdf: rows.find((row) => row.kind === 'file'),
      audio: rows.find((row) => row.kind === 'audio'),
      video: rows.find((row) => row.kind === 'video'),
    });
  });

  groups.sort((a, b) => {
    const positionOf = (group: AttachmentPairGroup) =>
      Math.min(
        group.pdf?.position ?? Number.MAX_SAFE_INTEGER,
        group.audio?.position ?? Number.MAX_SAFE_INTEGER,
        group.video?.position ?? Number.MAX_SAFE_INTEGER,
      );
    return positionOf(a) - positionOf(b);
  });

  return groups;
}
