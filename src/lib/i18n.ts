import { routing, type Locale } from '@/i18n/routing';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Locales that have real translations live in storefront pages (UI + content).
 * Hreflang must NOT advertise locales whose `/{locale}/foo` would render UK
 * content — Google then treats them as duplicates and ignores all hreflang.
 * Site is uk-only, so this list contains only 'uk'. To re-enable EN: add
 * 'en' here AND in src/i18n/routing.ts.
 */
const HREFLANG_LOCALES: Locale[] = ['uk'];

/**
 * Build `alternates.languages` for Next.js Metadata so each non-default locale
 * gets its own URL (prefixed) plus x-default points to the canonical (uk).
 * Pass the URL path (e.g. "/blog/foo"); the helper prepends APP_URL and the
 * locale prefix per the routing config.
 */
export function buildHreflang(pathWithLeadingSlash: string): Record<string, string> {
  const path = pathWithLeadingSlash.startsWith('/')
    ? pathWithLeadingSlash
    : `/${pathWithLeadingSlash}`;
  const languages: Record<string, string> = {};
  for (const locale of HREFLANG_LOCALES) {
    const url =
      locale === routing.defaultLocale ? `${APP_URL}${path}` : `${APP_URL}/${locale}${path}`;
    languages[locale] = url;
  }
  languages['x-default'] = `${APP_URL}${path}`;
  return languages;
}

/**
 * Pick a localized field with fallback to the default locale.
 *
 * Usage:
 *   const name = localize(product, 'name', locale);   // returns nameEn || name
 *   const desc = localize(category, 'description', locale);
 *
 * The DB schema follows the convention `<field>` for the default locale (uk)
 * and `<field>En` / `<field>Pl` / `<field>Ro` for translations. This helper
 * looks for the locale-specific column first; when null/empty it falls back
 * to the default-locale column, so storefront pages always render *something*
 * even if translations aren't filled in yet.
 */
export function localize<T extends object>(
  row: T | null | undefined,
  field: string,
  locale: Locale | string,
): string | null {
  if (!row) return null;
  const src = row as unknown as Record<string, unknown>;
  const base = src[field];
  if (locale === routing.defaultLocale) {
    return typeof base === 'string' ? base : null;
  }
  // capitalize: 'name' + 'En' → 'nameEn'
  const suffix = locale.charAt(0).toUpperCase() + locale.slice(1);
  const localized = src[`${field}${suffix}`];
  if (typeof localized === 'string' && localized.trim().length > 0) {
    return localized;
  }
  return typeof base === 'string' ? base : null;
}

/**
 * Build a record with the standard SEO fields resolved for the given locale.
 * Handy in generateMetadata so callers don't repeat the same localize() chain.
 */
export function localizeSeo<
  T extends Partial<{
    seoTitle: string | null;
    seoDescription: string | null;
    seoTitleEn: string | null;
    seoDescriptionEn: string | null;
  }>,
>(row: T | null | undefined, locale: Locale | string) {
  return {
    seoTitle: localize(row, 'seoTitle', locale),
    seoDescription: localize(row, 'seoDescription', locale),
  };
}

/**
 * Apply EN translations onto a DB row in-place-ish: returns a shallow copy
 * where any `<field>` whose `<field>En` is non-empty is overwritten with the
 * translation. Used in storefront pages so all downstream rendering keeps
 * using `row.name` / `row.description` etc. without per-field localize() calls.
 *
 * Default locale (uk) returns the row unchanged.
 *
 * @example
 *   const product = applyTranslations(await getProduct(slug), locale);
 *   // product.name now holds nameEn (when locale=en and nameEn is set)
 */
export function applyTranslations<T extends object>(
  row: T | null,
  locale: Locale | string,
): T | null {
  if (!row) return row;
  if (locale === routing.defaultLocale) return row;
  const suffix = locale.charAt(0).toUpperCase() + locale.slice(1);
  const src = row as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  for (const key of Object.keys(src)) {
    if (key.endsWith(suffix)) continue; // skip the EN field itself
    const enKey = `${key}${suffix}`;
    const enValue = src[enKey];
    if (typeof enValue === 'string' && enValue.trim().length > 0) {
      out[key] = enValue;
    }
  }
  return out as unknown as T;
}

/** Apply translations to every item in a list. Nested objects are NOT walked
 * — callers that need it (e.g. product.content) should re-apply on the child
 * after fetching, or use applyTranslationsDeep. */
export function applyTranslationsList<T extends object>(rows: T[], locale: Locale | string): T[] {
  if (locale === routing.defaultLocale) return rows;
  return rows.map((r) => applyTranslations(r, locale) as T);
}

/** Walk one level into nested objects/arrays of objects too. Specifically
 * targets fields like Product.content (object) and Product.images (array) so
 * a single call covers the common storefront shape. */
export function applyTranslationsDeep<T extends object>(
  row: T | null,
  locale: Locale | string,
): T | null {
  if (!row) return row;
  if (locale === routing.defaultLocale) return row;
  const translated = applyTranslations(row, locale) as Record<string, unknown>;
  for (const key of Object.keys(translated)) {
    const value = translated[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      translated[key] = applyTranslations(value as Record<string, unknown>, locale);
    } else if (Array.isArray(value)) {
      translated[key] = value.map((item) =>
        item && typeof item === 'object'
          ? applyTranslations(item as Record<string, unknown>, locale)
          : item,
      );
    }
  }
  return translated as T;
}
