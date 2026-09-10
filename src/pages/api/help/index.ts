import type { NextApiRequest, NextApiResponse } from 'next';
import { Op, type WhereOptions } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAdmin, withOptionalAuth } from '@/lib/middleware';
import { HelpArticle } from '@db/models';
import { helpArticleSchema } from '@/lib/validate';
import { Conflict } from '@/lib/errors';
import {
  sanitizeHelpContent,
  toHelpArticleDto,
  toHelpListItem,
} from '@/lib/helpUtils';
import {
  isHelpAudience,
  isHelpSection,
  type HelpAudience,
  type HelpSection,
} from '@/types/help';
import type { AuthenticatedRequest, TokenPayload } from '@/types/auth';

const MAX_SEARCH_LENGTH = 100;

function getCurrentUser(req: NextApiRequest): TokenPayload | undefined {
  return (req as Partial<AuthenticatedRequest>).user;
}

/**
 * Какие аудитории видит пользователь. Гости — только общие статьи,
 * остальные — общие плюс статьи для своей роли, админ — все.
 */
function visibleAudiences(user?: TokenPayload): HelpAudience[] {
  if (!user) return ['all'];
  if (user.role === 'admin') return ['all', 'admin', 'participant', 'mentor'];
  return ['all', user.role];
}

/**
 * Публичный список статей «Правила и помощь». Гости видят только
 * опубликованное; админу доступен режим `?all=1` — все статьи и все
 * аудитории (для управления разделом).
 */
async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = getCurrentUser(req);
  const isAdmin = user?.role === 'admin';
  const showAll = isAdmin && req.query.all === '1';

  const rawSearch =
    typeof req.query.search === 'string' ? req.query.search : '';
  const search = rawSearch.trim().slice(0, MAX_SEARCH_LENGTH);

  const sectionParam =
    typeof req.query.section === 'string' ? req.query.section : '';
  const section: HelpSection | null = isHelpSection(sectionParam)
    ? sectionParam
    : null;

  const audienceParam =
    typeof req.query.audience === 'string' ? req.query.audience : '';
  const audience: HelpAudience | null = isHelpAudience(audienceParam)
    ? audienceParam
    : null;

  const where: WhereOptions = {};

  if (!showAll) {
    Object.assign(where, { isPublished: true });
    if (user?.role !== 'admin') {
      Object.assign(where, { audience: { [Op.in]: visibleAudiences(user) } });
    }
  }

  if (section) {
    Object.assign(where, { section });
  }

  if (audience) {
    Object.assign(where, { audience });
  }

  if (search) {
    const like = `%${search}%`;
    Object.assign(where, {
      [Op.or]: [
        { title: { [Op.iLike]: like } },
        { summary: { [Op.iLike]: like } },
      ],
    });
  }

  const articles = await HelpArticle.findAll({
    where,
    order: [
      ['position', 'ASC'],
      ['title', 'ASC'],
    ],
  });

  return success(res, {
    items: articles.map(toHelpListItem),
    total: articles.length,
  });
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as AuthenticatedRequest).user;
  const body = helpArticleSchema.parse(req.body);

  const existing = await HelpArticle.findOne({
    where: { slug: body.slug },
    attributes: ['id'],
  });
  if (existing) {
    throw new Conflict('Статья с таким адресом уже существует');
  }

  const article = await HelpArticle.create({
    slug: body.slug,
    title: body.title,
    summary: body.summary ? body.summary : null,
    content: sanitizeHelpContent(body.content),
    section: body.section,
    audience: body.audience,
    position: body.position,
    isPublished: body.isPublished,
    createdBy: user.userId,
  });

  return success(res, toHelpArticleDto(article), 201);
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  POST: withAdmin(postHandler),
});
