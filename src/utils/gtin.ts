/**
 * GS1 GTIN (Global Trade Item Number) helpers.
 *
 * GTIN comes in four standard lengths:
 *   - GTIN-8  → EAN-8 (small packaging)
 *   - GTIN-12 → UPC-A (North America)
 *   - GTIN-13 → EAN-13 (most common in EU/UA)
 *   - GTIN-14 → ITF-14 (shipping containers, multi-pack outer carton)
 *
 * The last digit is a mod-10 checksum computed by weighting digits 3,1,3,1,…
 * from the right (excluding the check digit itself). A code that passes the
 * 8/12/13/14-digit length filter but fails this checksum is a typo, OCR
 * misread, or fabricated number — it should never make it into the catalogue.
 */

export function gs1CheckDigit(payload: string): number {
  let sum = 0;
  const reversed = payload.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    sum += Number(reversed[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string | null | undefined): boolean {
  if (!code) return false;
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const payload = code.slice(0, -1);
  const checkDigit = Number(code.slice(-1));
  return gs1CheckDigit(payload) === checkDigit;
}

/**
 * Returns a user-facing reason the code is invalid, or `null` if it is a
 * well-formed GTIN. Useful for friendly error messages in the admin UI.
 */
export function gtinValidationError(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'Штрихкод має містити лише цифри';
  if (![8, 12, 13, 14].includes(trimmed.length)) {
    return 'Штрихкод має бути 8, 12, 13 або 14 цифр (EAN-8, UPC-A, EAN-13, ITF-14)';
  }
  const expected = gs1CheckDigit(trimmed.slice(0, -1));
  const actual = Number(trimmed.slice(-1));
  if (expected !== actual) {
    return `Невірна контрольна цифра — правильна має бути ${expected}, введено ${actual}. Перевірте останню цифру.`;
  }
  return null;
}
