import type { Transaction } from 'sequelize';
import { UserConsent, type ConsentType } from '@db/models/UserConsent';
import { NotFound } from './errors';
import { CONSENT_DOCUMENTS } from './consent';
import type { UserConsentDto } from '@/types/consent';

export interface ConsentContext {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Зафиксировать согласие пользователя.
 *
 * Идемпотентно: повторная галочка тем же текстом не создаёт дубль, а только
 * обновляет доказательства (IP, User-Agent). Если текст сменил версию или
 * согласие было отозвано — запись переоформляется заново.
 */
export async function recordConsent(
  userId: string,
  type: ConsentType,
  context: ConsentContext,
  transaction?: Transaction
): Promise<UserConsent> {
  const version = CONSENT_DOCUMENTS[type].version;
  const now = new Date();

  const [record, created] = await UserConsent.findOrCreate({
    where: { userId, type },
    defaults: {
      userId,
      type,
      documentVersion: version,
      grantedAt: now,
      revokedAt: null,
      ip: context.ip,
      userAgent: context.userAgent,
    },
    transaction,
  });

  if (created) {
    return record;
  }

  const isSameActiveDocument =
    record.documentVersion === version && record.revokedAt === null;

  record.documentVersion = version;
  record.ip = context.ip;
  record.userAgent = context.userAgent;

  if (!isSameActiveDocument) {
    record.grantedAt = now;
    record.revokedAt = null;
  }

  await record.save({ transaction });
  return record;
}

/** Отозвать согласие: строка остаётся, проставляется `revokedAt`. */
export async function revokeConsent(
  userId: string,
  type: ConsentType
): Promise<UserConsent> {
  const record = await UserConsent.findOne({ where: { userId, type } });
  if (!record) {
    throw new NotFound('Согласие не найдено');
  }

  if (!record.revokedAt) {
    record.revokedAt = new Date();
    await record.save();
  }

  return record;
}

export async function listConsents(userId: string): Promise<UserConsent[]> {
  return UserConsent.findAll({
    where: { userId },
    order: [['type', 'ASC']],
  });
}

export function toConsentDto(record: UserConsent): UserConsentDto {
  return {
    type: record.type,
    documentVersion: record.documentVersion,
    grantedAt: record.grantedAt.toISOString(),
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    isActive: record.revokedAt === null,
  };
}
