import type { NextApiRequest } from 'next';

/**
 * Виды согласий на обработку персональных данных (152-ФЗ).
 *
 * Значение синхронизировано с `ConsentType` из `DB/models/UserConsent.ts`.
 * Файл намеренно не импортирует модели БД, чтобы его можно было
 * использовать и на клиенте (версии и адреса текстов).
 */
export type ConsentType = 'general' | 'health';

export interface ConsentDocument {
  /** Версия текста — фиксируется вместе с согласием. */
  version: string;
  title: string;
  /** Адрес текста на сайте (якорь на /privacy). */
  url: string;
}

export const CONSENT_TYPES: ConsentType[] = ['general', 'health'];

/**
 * Версия публичных текстов. Меняется при каждой правке: если текст
 * изменился, старое согласие уже недействительно и нужно новое.
 * Текущее значение — черновик (тексты ещё не проверены юристом).
 */
export const POLICY_VERSION = '2026-09-17-draft';

export const CONSENT_DOCUMENTS: Record<ConsentType, ConsentDocument> = {
  general: {
    version: '2026-09-17-draft',
    title: 'Согласие на обработку персональных данных',
    url: '/privacy#consent',
  },
  health: {
    version: '2026-09-17-draft',
    title: 'Согласие на обработку данных о здоровье',
    url: '/privacy#consent-health',
  },
};

export function isConsentType(value: unknown): value is ConsentType {
  return value === 'general' || value === 'health';
}

/** IP из заголовков прокси, иначе сокет. Обрезается под ширину колонки. */
export function extractClientIp(req: NextApiRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const candidate = raw?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  return candidate ? candidate.slice(0, 64) : null;
}

/** User-Agent на момент согласия. Обрезается под ширину колонки. */
export function extractUserAgent(req: NextApiRequest): string | null {
  const raw = req.headers['user-agent'];
  return raw ? raw.slice(0, 512) : null;
}
