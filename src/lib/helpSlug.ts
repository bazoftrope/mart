/**
 * Слаги статей, на которые ссылаются интерфейс и код. Заводятся
 * сидером `demo-help-articles`; если статью удалить или переименовать,
 * соответствующие ссылки в интерфейсе начнут вести на 404.
 */
export const HELP_SLUG_RULES = 'pravila-marafona';
export const HELP_SLUG_REPORT_GUIDE = 'kak-zapolnyat-otchet';

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/**
 * Превращает заголовок статьи в человекочитаемый slug для URL.
 * Кириллица транслитерируется, всё лишнее отбрасывается.
 * Используется и на клиенте (автоподстановка), и на сервере.
 */
export function slugifyHelpTitle(title: string): string {
  const lower = title.toLowerCase().trim();
  let result = '';

  for (const char of lower) {
    if (TRANSLIT[char] !== undefined) {
      result += TRANSLIT[char];
    } else if (/[a-z0-9]/.test(char)) {
      result += char;
    } else {
      result += '-';
    }
  }

  return result
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
    .replace(/-$/g, '');
}
