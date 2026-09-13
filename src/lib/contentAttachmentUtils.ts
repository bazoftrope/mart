import type { ContentAttachment } from '@db/models/ContentAttachment';
import type { ContentAttachmentData } from '@/types/attachments';

export function serializeContentAttachment(attachment: ContentAttachment): ContentAttachmentData {
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

export function serializeContentAttachments(attachments: ContentAttachment[]): ContentAttachmentData[] {
  return attachments
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(serializeContentAttachment);
}
