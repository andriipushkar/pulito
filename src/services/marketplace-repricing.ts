import { prisma } from '@/lib/prisma';
import type { MarketplacePlatform } from '@/services/marketplace-health';

/**
 * Dynamic pricing rules per marketplace. Stored as a JSON array in
 * siteSetting under `marketplace_repricing_<platform>` and evaluated
 * top-to-bottom — the first rule that matches contributes its adjustment.
 *
 * Each rule produces a multiplier; multipliers from multiple matching
 * rules are NOT multiplied together — only the first match wins, to keep
 * the math debuggable for shop owners.
 */
export type RepricingCondition =
  | { type: 'stock_below'; value: number }
  | { type: 'stock_above'; value: number }
  | { type: 'date_between'; from: string; to: string }
  | { type: 'category_in'; categoryIds: number[] }
  | { type: 'product_in'; productIds: number[] }
  | { type: 'always' };

export interface RepricingRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: RepricingCondition;
  /** Percentage adjustment, e.g. 5 = +5%, -10 = -10%. Clamped to ±50%. */
  markupPercent: number;
}

const KEY = (platform: string) => `marketplace_repricing_${platform}`;
const MAX_MARKUP = 50;

export async function getRepricingRules(
  platform: MarketplacePlatform,
): Promise<RepricingRule[]> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY(platform) } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value) as RepricingRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRepricingRules(
  platform: MarketplacePlatform,
  rules: RepricingRule[],
): Promise<void> {
  const cleaned = rules
    .filter((r) => r && typeof r.id === 'string' && typeof r.name === 'string')
    .map((r) => ({
      ...r,
      markupPercent: Math.max(-MAX_MARKUP, Math.min(MAX_MARKUP, Number(r.markupPercent) || 0)),
    }));
  const value = JSON.stringify(cleaned);
  await prisma.siteSetting.upsert({
    where: { key: KEY(platform) },
    create: { key: KEY(platform), value },
    update: { value },
  });
}

interface EvalContext {
  stock: number;
  now: Date;
  categoryId: number | null;
  productId?: number | null;
}

function ruleMatches(rule: RepricingRule, ctx: EvalContext): boolean {
  if (!rule.enabled) return false;
  switch (rule.condition.type) {
    case 'always':
      return true;
    case 'stock_below':
      return ctx.stock < rule.condition.value;
    case 'stock_above':
      return ctx.stock > rule.condition.value;
    case 'date_between': {
      const from = new Date(rule.condition.from);
      const to = new Date(rule.condition.to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
      return ctx.now >= from && ctx.now <= to;
    }
    case 'category_in':
      return ctx.categoryId != null && rule.condition.categoryIds.includes(ctx.categoryId);
    case 'product_in':
      return ctx.productId != null && rule.condition.productIds.includes(ctx.productId);
  }
}

/**
 * Returns the additional markup percent for this marketplace given the
 * current stock/date/category context. Returns 0 if no rule matches.
 * The base channel-wide `priceMarkupPercent` from channel config is applied
 * separately (in services/marketplaces.ts); this stacks ON TOP of it.
 */
export async function evalRepricing(
  platform: MarketplacePlatform,
  ctx: EvalContext,
): Promise<number> {
  const rules = await getRepricingRules(platform);
  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) return rule.markupPercent;
  }
  return 0;
}
