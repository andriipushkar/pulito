// Centralised URL safety check for admin-supplied links (banner buttonLink,
// campaign CTAs, etc). Blocks `javascript:`, `data:`, `vbscript:` and similar
// schemes that would render the link as XSS. Allows http(s), tel:, mailto:,
// and same-origin paths starting with `/`.
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function isSafeUrl(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = String(value).trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//'); // protocol-relative is unsafe (loads cross-origin)
  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}
