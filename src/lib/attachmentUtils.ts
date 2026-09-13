import type { TemplateAttachment } from '@db/models/TemplateAttachment';
import type { AttachmentData } from '@/types/attachments';
import { sanitizeRichText } from './sanitize';

export function serializeAttachment(attachment: TemplateAttachment): AttachmentData {
  return {
    id: attachment.id,
    kind: attachment.kind,
    url: attachment.url,
    fileName: attachment.fileName ?? null,
    mimeType: attachment.mimeType ?? null,
    sizeBytes: attachment.sizeBytes ?? null,
    position: attachment.position,
    pairId: attachment.pairId ?? null,
    description: (attachment.description as string | null | undefined) ?? null,
  };
}

export function serializeAttachments(attachments: TemplateAttachment[]): AttachmentData[] {
  return attachments
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(serializeAttachment);
}

export function sanitizeTemplateText(
  value: string | undefined | null
): string | undefined | null {
  if (value === undefined || value === null) {
    return value;
  }
  return sanitizeRichText(value);
}
