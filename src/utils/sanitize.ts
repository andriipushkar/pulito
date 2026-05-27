import DOMPurify from 'isomorphic-dompurify';

// Curated CSS-property allowlist for the `style` attribute. Without it,
// admin-saved inline styles could include `expression(alert(1))` (legacy
// IE XSS vector) or `-moz-binding: url(...)` (XBL XSS) — modern browsers
// drop these, but defence-in-depth costs nothing. Keep limited to what
// the TipTap rich editor actually emits.
const ALLOWED_CSS_PROPERTIES = [
  'color',
  'background-color',
  'background',
  'text-align',
  'text-decoration',
  'text-indent',
  'font-weight',
  'font-style',
  'font-size',
  'font-family',
  'line-height',
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'padding',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'width',
  'height',
  'max-width',
  'max-height',
  'border',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'display',
  'float',
  'clear',
  'vertical-align',
  'list-style',
];

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags and attributes commonly used in rich text content.
 */
export function sanitizeHtml(dirty: string): string {
  // DOMPurify's TS types omit `ALLOWED_CSS_PROPERTIES` (the runtime supports
  // it). Build the config as a plain object and cast at the call site so the
  // rest of the typed properties still get checked.
  const config = {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'hr',
      'ul',
      'ol',
      'li',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'del',
      'ins',
      'mark',
      'sub',
      'sup',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'blockquote',
      'pre',
      'code',
      'div',
      'span',
      'figure',
      'figcaption',
      'video',
      'source',
    ],
    ALLOWED_ATTR: [
      'href',
      'target',
      'rel',
      'src',
      'alt',
      'width',
      'height',
      'loading',
      'class',
      'style',
      'colspan',
      'rowspan',
      'controls',
      'type',
      // TipTap multicolor highlight stores the colour via data-color too
      'data-color',
    ],
    ALLOWED_CSS_PROPERTIES,
  };
  return DOMPurify.sanitize(dirty, config as Parameters<typeof DOMPurify.sanitize>[1]);
}
