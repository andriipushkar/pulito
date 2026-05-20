/**
 * Heuristic category mapper: given a product name + description, suggests
 * candidate local categories by token-overlap with existing category names.
 *
 * Not LLM-backed — no external dependencies, no API costs, deterministic
 * output. Suitable for "did you mean?" hints and bulk-import fallbacks.
 */
import { prisma } from '@/lib/prisma';

const STOPWORDS = new Set([
  // Ukrainian common stopwords
  'і', 'та', 'або', 'але', 'для', 'що', 'як', 'на', 'у', 'в', 'до', 'з', 'по', 'не', 'без', 'про',
  'від', 'над', 'під', 'при', 'ця', 'цей', 'це', 'то', 'той', 'та', 'те', 'із', 'зі', 'все',
  // Russian common stopwords (Lviv shoppers may search/use Russian too)
  'и', 'или', 'но', 'для', 'что', 'как', 'на', 'у', 'в', 'до', 'с', 'по', 'не', 'без', 'про',
  // English
  'and', 'or', 'the', 'a', 'an', 'for', 'with', 'of', 'in', 'on', 'at', 'to',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export interface CategorySuggestion {
  categoryId: number;
  categoryName: string;
  score: number; // 0–1: fraction of product tokens matched by category tokens
}

/**
 * Suggests up to `limit` local categories that best match the product text.
 * Algorithm: cosine-like similarity between product token set and category
 * token set (name + slug). Cached per request — caller should call once per
 * product.
 */
export async function suggestLocalCategory(
  productText: string,
  limit = 5,
): Promise<CategorySuggestion[]> {
  const productTokens = new Set(tokenize(productText));
  if (productTokens.size === 0) return [];

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    where: { isVisible: true, deletedAt: null },
  });

  const scored = categories.map((cat) => {
    const catTokens = new Set([
      ...tokenize(cat.name),
      ...tokenize(cat.slug || ''),
    ]);
    if (catTokens.size === 0) return { categoryId: cat.id, categoryName: cat.name, score: 0 };

    let overlap = 0;
    for (const t of productTokens) {
      if (catTokens.has(t)) overlap++;
    }
    const denominator = Math.sqrt(productTokens.size * catTokens.size);
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      score: denominator > 0 ? overlap / denominator : 0,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Given an external category name from a marketplace (e.g. "Електроінструменти")
 * suggests the best-matching LOCAL category, useful when importing categories
 * from the marketplace and pre-filling our mapping table.
 */
export async function suggestLocalCategoryFromExternal(
  externalCategoryName: string,
  limit = 3,
): Promise<CategorySuggestion[]> {
  return suggestLocalCategory(externalCategoryName, limit);
}
