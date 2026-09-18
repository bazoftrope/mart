import sanitizeHtml from 'sanitize-html';

const COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|(?:[a-zA-Z]+))$/i;

const FONT_PATTERN =
  /^(?:Onest|Golos Text|Arial|Helvetica|Verdana|Tahoma|system-ui|sans-serif)$/i;

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'h1',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'span',
      'pre',
      'code',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      pre: ['style'],
      code: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedStyles: {
      '*': {
        color: [COLOR_PATTERN],
        'background-color': [COLOR_PATTERN],
        'font-family': [FONT_PATTERN],
        'font-size': [
          /^\d{1,3}(?:px|pt|em|rem|%)$/,
          /^(?:small|medium|large|x-large|xx-large|smaller|larger)$/,
        ],
        'text-align': [/^(?:left|center|right|justify)$/],
        'font-weight': [/^(?:normal|bold|[1-9]00)$/],
        'font-style': [/^(?:normal|italic|oblique)$/],
        'text-decoration': [/^(?:underline|line-through|none)$/],
      },
    },
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          href: attribs.href,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
    },
    disallowedTagsMode: 'discard',
  });
}
