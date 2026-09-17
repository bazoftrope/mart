import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { sequelize } from '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { BadRequest, NotFound } from '@/lib/errors';
import { User } from '@db/models';
import { toPublicUser, verifyPassword, clearAuthCookies } from '@/lib/auth';
import { deleteAccountSchema, profileSchema } from '@/lib/validate';
import { recordConsent } from '@/lib/consentService';
import { extractClientIp, extractUserAgent } from '@/lib/consent';
import { deleteUserAccount } from '@/lib/userDataService';
import { isProfileComplete } from '@/lib/calorieCalculator';
import type { AuthenticatedRequest } from '@/types/auth';

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;

  const dbUser = await User.findByPk(user.userId);
  if (!dbUser) {
    throw new NotFound('User not found');
  }

  const publicUser = toPublicUser(dbUser);

  return success(res, {
    user: publicUser,
    profileCompleted: isProfileComplete({
      sex: publicUser.sex,
      heightCm: publicUser.heightCm,
      weightKg: publicUser.weightKg,
      age: publicUser.age,
    }),
  });
}

async function patchHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const body = profileSchema.parse(req.body);

  const dbUser = await User.findByPk(user.userId);
  if (!dbUser) {
    throw new NotFound('User not found');
  }

  // Профиль (вес, рост, возраст) — специальная категория ПДн, поэтому
  // сохраняем его только вместе с фиксацией согласия на их обработку.
  const consentContext = {
    ip: extractClientIp(req),
    userAgent: extractUserAgent(req),
  };

  await sequelize.transaction(async (transaction) => {
    dbUser.sex = body.sex;
    dbUser.heightCm = body.heightCm;
    dbUser.weightKg = body.weightKg;
    dbUser.age = body.age;
    await dbUser.save({ transaction });

    await recordConsent(dbUser.id, 'health', consentContext, transaction);
  });

  const publicUser = toPublicUser(dbUser);

  return success(res, {
    user: publicUser,
    profileCompleted: isProfileComplete({
      sex: publicUser.sex,
      heightCm: publicUser.heightCm,
      weightKg: publicUser.weightKg,
      age: publicUser.age,
    }),
  });
}

/**
 * Удаление аккаунта и связанных персональных данных (участник).
 * Требует пароль и контрольное слово — операция необратима.
 */
async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const body = deleteAccountSchema.parse(req.body);

  const dbUser = await User.findByPk(user.userId);
  if (!dbUser) {
    throw new NotFound('User not found');
  }

  const passwordOk = await verifyPassword(body.password, dbUser.passwordHash);
  if (!passwordOk) {
    throw new BadRequest('Неверный пароль');
  }

  await deleteUserAccount(user.userId);
  clearAuthCookies(res);

  return success(res, { deleted: true });
}

export default apiHandler({
  GET: withAuth(getHandler),
  PATCH: withAuth(patchHandler),
  DELETE: withAuth(deleteHandler),
});
