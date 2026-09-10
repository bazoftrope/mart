import type { HelpArticle as HelpArticleModel } from '@db/models/HelpArticle';
import type { HelpArticle, HelpArticleListItem } from '@/types/help';
import { sanitizeRichText } from './sanitize';

/** HTML статьи санируется при сохранении, отдаём уже безопасный текст. */
export function sanitizeHelpContent(html: string): string {
  return sanitizeRichText(html);
}

export function toHelpListItem(article: HelpArticleModel): HelpArticleListItem {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary ?? null,
    section: article.section,
    audience: article.audience,
    position: article.position,
    isPublished: article.isPublished,
    updatedAt: article.updatedAt.toISOString(),
  };
}

export function toHelpArticleDto(article: HelpArticleModel): HelpArticle {
  return {
    ...toHelpListItem(article),
    content: article.content,
    createdAt: article.createdAt.toISOString(),
  };
}
