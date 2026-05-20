/**
 * Best-effort phone normalization for Ukrainian numbers. We strip everything
 * non-numeric then map common prefixes back to a `+380…` canonical form:
 *   0961234567       → +380961234567
 *   380961234567     → +380961234567
 *   +380961234567    → +380961234567
 *   80961234567      → +380961234567   (old MTC/Kyivstar format)
 * Anything we can't recognise as a UA number is returned unchanged (digits-only).
 */
export function normalizeUaPhone(input: string | null | undefined): string {
  if (!input) return '';
  const digits = input.replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('80')) return `+3${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  // Already canonical or unrecognised format — return digits.
  return digits.startsWith('380') || digits.startsWith('0') ? digits : `+${digits}`;
}

/**
 * Generate search variants for a phone-like query so substring matching
 * works regardless of whether the stored value or the query has +380, 380
 * or 0 prefix. Returns at minimum one entry (the original query).
 */
export function phoneSearchVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length < 5) return [trimmed]; // too short to be a phone
  const variants = new Set<string>([trimmed]);
  variants.add(digits);
  // 0961234567 ↔ +380961234567
  if (digits.startsWith('0') && digits.length === 10) {
    variants.add(`380${digits.slice(1)}`);
    variants.add(`+380${digits.slice(1)}`);
    variants.add(digits.slice(1));
  }
  // 380961234567 ↔ 0961234567
  if (digits.startsWith('380') && digits.length === 12) {
    variants.add(`0${digits.slice(3)}`);
    variants.add(`+${digits}`);
    variants.add(digits.slice(3));
  }
  return [...variants];
}
