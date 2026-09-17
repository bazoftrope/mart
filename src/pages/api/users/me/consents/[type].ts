import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { BadRequest } from '@/lib/errors';
import { isConsentType } from '@/lib/consent';
import { revokeConsent, toConsentDto } from '@/lib/consentService';
import type { AuthenticatedRequest } from '@/types/auth';

/**
 * Отзыв согласия. Строка не удаляется: проставляется `revokedAt`,
 * чтобы история согласий сохранилась как доказательство.
 */
async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const { type } = req.query;

  if (!isConsentType(type)) {
    throw new BadRequest('Неизвестный вид согласия');
  }

  const record = await revokeConsent(user.userId, type);

  return success(res, { consent: toConsentDto(record) });
}

export default apiHandler({
  DELETE: withAuth(deleteHandler),
});
