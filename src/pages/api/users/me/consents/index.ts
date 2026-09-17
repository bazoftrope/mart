import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { grantConsentSchema } from '@/lib/validate';
import { CONSENT_DOCUMENTS, extractClientIp, extractUserAgent } from '@/lib/consent';
import { listConsents, recordConsent, toConsentDto } from '@/lib/consentService';
import type { AuthenticatedRequest } from '@/types/auth';

/** Текущие согласия пользователя и версии текстов. */
async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const records = await listConsents(user.userId);

  return success(res, {
    consents: records.map(toConsentDto),
    documents: CONSENT_DOCUMENTS,
  });
}

/** Зафиксировать согласие. Идемпотентно — можно вызывать повторно. */
async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const { type } = grantConsentSchema.parse(req.body);

  const record = await recordConsent(user.userId, type, {
    ip: extractClientIp(req),
    userAgent: extractUserAgent(req),
  });

  return success(res, { consent: toConsentDto(record) }, 201);
}

export default apiHandler({
  GET: withAuth(getHandler),
  POST: withAuth(postHandler),
});
