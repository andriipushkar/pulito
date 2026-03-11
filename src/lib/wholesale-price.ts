import type { WholesaleGroup } from '@/types/user';

/**
 * Resolves the wholesale price for a given user's wholesale group.
 * Returns the group-specific wholesale price, or null if unavailable.
 */
export function resolveWholesalePrice(
  product: { priceWholesale?: unknown; priceWholesale2?: unknown; priceWholesale3?: unknown },
  wholesaleGroup: WholesaleGroup | number | null | undefined
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
  return raw != null ? Number(raw) : null;
}
