import type { SupplierMarkupType } from '@/../generated/prisma';
import { addMoney, percentOf, maxMoney, round2 } from '@/utils/money';

/**
 * Compute our retail price from a supplier's purchase price + a markup rule.
 * All arithmetic goes through @/utils/money so rounding is kopeck-exact.
 *
 * - percent: cost + cost·value%   (value = 30 → +30%)
 * - fixed:   cost + value UAH
 *
 * The result is floored to `minPrice` when set, so a thin-margin or zero-markup
 * config can never publish a price below the supplier's agreed floor.
 */
export function computeRetailPrice(
  cost: number,
  markupType: SupplierMarkupType,
  markupValue: number,
  minPrice: number | null,
): number {
  const withMarkup =
    markupType === 'percent'
      ? addMoney(cost, percentOf(cost, markupValue))
      : addMoney(cost, markupValue);
  const floored = minPrice != null ? maxMoney(withMarkup, minPrice) : withMarkup;
  return round2(floored);
}
