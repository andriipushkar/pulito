import type { WholesaleGroup } from '@/types/user';

/**
 * Resolves the wholesale price for a given user's wholesale group.
 * Returns the group-specific wholesale price, or null if unavailable.
 */
export function resolveWholesalePrice(
  product: { priceWholesale?: unknown; priceWholesale2?: unknown; priceWholesale3?: unknown },
  wholesaleGroup: WholesaleGroup | number | null | undefined,
): number | null {
  if (!wholesaleGroup) return null;
  let raw: unknown;
  switch (wholesaleGroup) {
    case 1:
      raw = product.priceWholesale;
      break;
    case 2:
      raw = product.priceWholesale2;
      break;
    case 3:
      raw = product.priceWholesale3;
      break;
    default:
      return null;
  }
  // Treat <= 0 as "no wholesale price for this tier" — a column stored as 0
  // (unset) must NOT become a free order via the Math.min ceiling at checkout.
  if (raw == null) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}
