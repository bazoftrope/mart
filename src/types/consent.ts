import type { ConsentType, ConsentDocument } from '@/lib/consent';

/** DTO согласия для клиента. */
export interface UserConsentDto {
  type: ConsentType;
  documentVersion: string;
  grantedAt: string;
  revokedAt: string | null;
  isActive: boolean;
}

/** Ответ `GET /api/users/me/consents`. */
export interface ConsentsResponse {
  consents: UserConsentDto[];
  documents: Record<ConsentType, ConsentDocument>;
}
