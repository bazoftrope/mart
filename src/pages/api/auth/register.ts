import '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import { sequelize } from '@/lib/db';
import { User } from '@db/models/User';
import { apiHandler, success } from '@/lib/apiHandler';
import { Conflict } from '@/lib/errors';
import { registerSchema } from '@/lib/validate';
import { recordConsent } from '@/lib/consentService';
import { extractClientIp, extractUserAgent } from '@/lib/consent';
import {
  hashPassword,
  setAuthCookies,
  toPublicUser,
  isAdminCredential,
} from '@/lib/auth';

async function post(req: NextApiRequest, res: NextApiResponse) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { email, password, name, role } = parsed.data;

  if (isAdminCredential(email)) {
    throw new Conflict('This email is reserved for admin login');
  }

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new Conflict('User with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const consentContext = {
    ip: extractClientIp(req),
    userAgent: extractUserAgent(req),
  };

  // Пользователь и фиксация его согласия создаются одной транзакцией:
  // аккаунт без доказательства согласия недопустим.
  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create(
      {
        email: email.toLowerCase(),
        passwordHash,
        role,
        name,
        timezone: 'Europe/Moscow',
      },
      { transaction }
    );

    await recordConsent(created.id, 'general', consentContext, transaction);

    return created;
  });

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  setAuthCookies(res, payload);

  return success(res, { user: toPublicUser(user) }, 201);
}

export default apiHandler({ POST: post });
