import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { exportUserData } from '@/lib/userDataService';
import type { AuthenticatedRequest } from '@/types/auth';

/**
 * Экспорт персональных данных пользователя (право субъекта, 152-ФЗ).
 * Отдаётся файлом JSON, пароль в выгрузку не попадает.
 */
async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const data = await exportUserData(user.userId);

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="marathon-platform-data-${date}.json"`
  );

  res.status(200).send(JSON.stringify(data, null, 2));
}

export default apiHandler({ GET: withAuth(getHandler) });
