import slugify from 'slugify';
import { transliterate } from 'transliteration';

/**
 * Build a URL slug from text. Capped at `maxLength` (default 70) so long product
 * names don't produce overly long URLs — the SEO audit flags slugs > 75, and a
 * collision suffix (e.g. `-<code>`) is appended later, so we leave headroom.
 * Truncation happens at a hyphen (word) boundary, never mid-word.
 */
export function createSlug(text: string, maxLength = 70): string {
  const transliterated = transliterate(text);
  let slug = slugify(transliterated, {
    lower: true,
    strict: true,
    trim: true,
  });
  if (maxLength > 0 && slug.length > maxLength) {
    slug = slug.slice(0, maxLength);
    const lastHyphen = slug.lastIndexOf('-');
    // Cut back to the last word boundary if it isn't too aggressive.
    if (lastHyphen > maxLength * 0.5) slug = slug.slice(0, lastHyphen);
    slug = slug.replace(/-+$/, '');
  }
  return slug;
}
