export type HelpSection = 'rules' | 'faq' | 'guide';
export type HelpAudience = 'all' | 'participant' | 'mentor' | 'admin';

/** Элемент списка раздела «Правила и помощь» (без полного текста). */
export type HelpArticleListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  section: HelpSection;
  audience: HelpAudience;
  position: number;
  isPublished: boolean;
  updatedAt: string;
};

export type HelpArticle = HelpArticleListItem & {
  content: string;
  createdAt: string;
};

export type HelpListResponse = {
  items: HelpArticleListItem[];
  total: number;
};

export const HELP_SECTION_LABELS: Record<HelpSection, string> = {
  rules: 'Правила',
  faq: 'Частые вопросы',
  guide: 'Инструкции',
};

export const HELP_SECTION_ORDER: HelpSection[] = ['rules', 'guide', 'faq'];

export const HELP_AUDIENCE_LABELS: Record<HelpAudience, string> = {
  all: 'Для всех',
  participant: 'Участникам',
  mentor: 'Менторам',
  admin: 'Админам',
};

export function isHelpSection(value: unknown): value is HelpSection {
  return value === 'rules' || value === 'faq' || value === 'guide';
}

export function isHelpAudience(value: unknown): value is HelpAudience {
  return (
    value === 'all' ||
    value === 'participant' ||
    value === 'mentor' ||
    value === 'admin'
  );
}
