/**
 * Maps a product badge `badgeType` to its display label.
 *
 * Public product components (ProductCard / ProductInfo) previously rendered the
 * raw `badgeType` (e.g. "new_arrival"), which the Badge component uppercases —
 * surfacing "NEW_ARRIVAL" to shoppers on products that carry an explicit badge
 * record, while flag-driven badges showed the friendly "Новинка". This map
 * keeps both paths consistent. Labels mirror the admin ProductBadgesSection
 * (typePromo/typeNewArrival/…) so admin and storefront read the same.
 */
const BADGE_TYPE_LABELS: Record<string, string> = {
  promo: 'Акція',
  new_arrival: 'Новинка',
  hit: 'Хіт',
  eco: 'Еко',
  custom: 'Інший',
};

export function badgeTypeLabel(badgeType: string): string {
  return BADGE_TYPE_LABELS[badgeType] ?? badgeType;
}
