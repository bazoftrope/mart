import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAdmin, withOptionalAuth } from '@/lib/middleware';
import { HelpArticle } from '@db/models';
import { helpArticleSchema } from '@/lib/validate';
import { Conflict, NotFound } from '@/lib/errors';
import {
  sanitizeHelpContent,
  toHelpArticleDto,
} from '@/lib/helpUtils';
import type { AuthenticatedRequest } from '@/types/auth';

function readSlug(req: NextApiRequest): string {
  const raw = req.query.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  return (slug ?? '').trim();
}

/**
 * Неопубликованную статью видит только админ; для всех остальных
 * она неотличима от несуществующей.
 */
async function loadArticle(req: NextApiRequest) {
  const slug = readSlug(req);
  if (!slug) {
    throw new NotFound('Статья не найдена');
  }

  const article = await HelpArticle.findOne({ where: { slug } });
  if (!article) {
    throw new NotFound('Статья не найдена');
  }

  const user = (req as Partial<AuthenticatedRequest>).user;
  if (!article.isPublished && user?.role !== 'admin') {
    throw new NotFound('Статья не найдена');
  }

  return article;
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const article = await loadArticle(req);
  return success(res, toHelpArticleDto(article));
}

async function putHandler(req: NextApiRequest, res: NextApiResponse) {
  const article = await loadArticle(req);
  const body = helpArticleSchema.parse(req.body);

  if (body.slug !== article.slug) {
    const existing = await HelpArticle.findOne({
      where: { slug: body.slug, id: { [Op.ne]: article.id } },
      attributes: ['id'],
    });
    if (existing) {
      throw new Conflict('Статья с таким адресом уже существует');
    }
  }

  await article.update({
    slug: body.slug,
    title: body.title,
    summary: body.summary ? body.summary : null,
    content: sanitizeHelpContent(body.content),
    section: body.section,
    audience: body.audience,
    position: body.position,
    isPublished: body.isPublished,
  });

  return success(res, toHelpArticleDto(article));
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const article = await loadArticle(req);
  const id = article.id;
  await article.destroy();
  return success(res, { id });
}

export default apiHandler({
  GET: withOptionalAuth(getHandler),
  PUT: withAdmin(putHandler),
  DELETE: withAdmin(deleteHandler),
});
