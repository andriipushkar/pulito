import type { MarketplacePlatform } from '@/services/marketplace-health';

/**
 * Parses a product specification blob into structured key/value pairs.
 *
 * Accepts lines of these forms (mix freely):
 *   - "Колір: Червоний"
 *   - "Brand=Pulito"
 *   - "Розмір — XL"
 */
export function parseSpecifications(text: string | null | undefined): Record<string, string> {
  if (!text) return {};
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([\p{Letter}\p{Number}_\s-]+?)\s*[:=—–]\s*(.+)$/u);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/**
 * Maps generic attribute keys (UA + EN) to marketplace-specific param fields.
 * Unknown keys are passed through with their original name — the marketplace
 * will ignore params it doesn't recognise, but Rozetka/Prom honour custom
 * params in their `params` array.
 */
const CANONICAL_KEYS: Record<string, string> = {
  // Ukrainian → canonical
  бренд: 'brand',
  виробник: 'brand',
  модель: 'model',
  колір: 'color',
  розмір: 'size',
  матеріал: 'material',
  вага: 'weight',
  обсяг: 'volume',
  // Russian → canonical
  бренд_ru: 'brand',
  цвет: 'color',
  размер: 'size',
  материал: 'material',
  вес: 'weight',
  объем: 'volume',
  // English → canonical
  brand: 'brand',
  manufacturer: 'brand',
  model: 'model',
  color: 'color',
  colour: 'color',
  size: 'size',
  material: 'material',
  weight: 'weight',
  volume: 'volume',
};

export function canonicaliseKey(key: string): string {
  return CANONICAL_KEYS[key.toLowerCase()] || key.toLowerCase().replace(/\s+/g, '_');
}

export interface MarketplaceAttribute {
  key: string;
  value: string;
}

export function mapAttributesForMarketplace(
  attrs: Record<string, string>,
  _platform: MarketplacePlatform,
): MarketplaceAttribute[] {
  // For now every platform receives the same canonical keys. When platforms
  // diverge (e.g. Rozetka uses numeric param IDs), add per-platform tables here.
  return Object.entries(attrs).map(([k, v]) => ({ key: canonicaliseKey(k), value: v }));
}
