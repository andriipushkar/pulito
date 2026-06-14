/**
 * Shared parsing primitives for supplier/catalog feeds. Both the legacy catalog
 * importer (`services/import.ts`) and the consignment sync feed-parser
 * (`services/suppliers/feed-parser.ts`) use these so price/quantity/encoding
 * handling can't silently diverge (they previously had two copies that already
 * disagreed on whitespace handling).
 */

/**
 * Decode a feed buffer to text honouring its declared charset. Ukrainian 1С
 * (CommerceML) and Excel-exported CSV are very often windows-1251 — decoding
 * those as UTF-8 turns Cyrillic headers/SKUs into mojibake and silently breaks
 * matching. We honour BOMs, an XML prolog `encoding="..."`, and otherwise
 * default to UTF-8 but fall back to windows-1251 when the UTF-8 decode produces
 * replacement chars (i.e. the bytes weren't valid UTF-8 — almost always cp1251).
 */
export function decodeFeedBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf8', 3); // UTF-8 BOM
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer);
  }
  // <?xml version="1.0" encoding="windows-1251"?> — the prolog is pure ASCII.
  const head = buffer.toString('latin1', 0, 200);
  const declared = head.match(/encoding\s*=\s*["']([\w-]+)["']/i)?.[1]?.toLowerCase();
  if (declared && declared !== 'utf-8' && declared !== 'utf8') {
    try {
      return new TextDecoder(declared).decode(buffer);
    } catch {
      /* unknown label — fall through to detection */
    }
  }
  const utf8 = buffer.toString('utf8');
  if (utf8.includes('�')) {
    try {
      return new TextDecoder('windows-1251').decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/**
 * Parse a decimal price with locale-aware thousands/decimal separators. <= 0 /
 * NaN → null (a zero purchase price means a mis-mapped or garbage feed, never a
 * real free product). Handles UA "1 299,90", US "1,299.90", EU "1.299,90" and
 * grouped "1,234,567.89" without the classic first-comma-only 1000× bug.
 */
export function parseFeedPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  }
  const raw = String(value).trim();
  const negative = raw.startsWith('-'); // a negative price is always rejected below
  // Keep only digits and separators (drops spaces, currency symbols, signs).
  const s = raw.replace(/[^\d.,]/g, '');
  if (!s) return null;

  let normalized: string;
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (lastSep === -1) {
    normalized = s;
  } else {
    const intPart = s.slice(0, lastSep).replace(/[.,]/g, ''); // strip grouping
    const fracPart = s.slice(lastSep + 1);
    const hadOtherSep = /[.,]/.test(s.slice(0, lastSep));
    // A lone trailing group of exactly 3 digits is a thousands group, not a
    // decimal ("1,234" = 1234, not 1.234); otherwise it's the decimal part.
    normalized =
      fracPart.length === 3 && !hadOtherSep ? intPart + fracPart : `${intPart}.${fracPart}`;
  }

  let num = parseFloat(normalized);
  if (negative) num = -num;
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

/** Non-negative integer quantity; anything unparseable → 0. Strips spaces so
 *  grouped "1 000" reads as 1000, not 1. */
export function parseFeedQuantity(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseInt(String(value).replace(/\s/g, ''), 10);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}
