import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { getDeletionImpact } from '@/lib/userDataService';
import type { AuthenticatedRequest } from '@/types/auth';

/**
 * Последствия удаления аккаунта: сколько шаблонов, потоков, записей и
 * участников будет затронуто. Нужно, чтобы подтверждение удаления было
 * осознанным (у ментора каскад затрагивает данные других людей).
 */
async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const impact = await getDeletionImpact(user.userId);
  return success(res, impact);
}

export default apiHandler({ GET: withAuth(getHandler) });
