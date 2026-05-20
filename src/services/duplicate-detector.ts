import { prisma } from '@/lib/prisma';

/**
 * Duplicate-product detection.
 *
 * Approach:
 *   1. Pull all active products (limited fields)
 *   2. Normalize each name → lowercase, strip diacritics, collapse whitespace
 *   3. Bucket by trigram signature so we only compare candidates that share
 *      at least one rare trigram (drops the quadratic cost on big catalogs)
 *   4. Pairwise Jaccard similarity on trigrams; require similarity >= threshold
 *   5. Boosts: same category OR same brand OR code prefix shared
 *
 * Returns pairs (not transitive groups) to keep the UI explicit about which
 * comparison the score refers to.
 */

interface DuplicateCandidate {
  product: {
    id: number;
    name: string;
    code: string;
    categoryId: number | null;
    brandId: number | null;
    priceRetail: number;
    quantity: number;
  };
}

export interface DuplicatePair {
  a: DuplicateCandidate['product'];
  b: DuplicateCandidate['product'];
  similarity: number;
  reasons: string[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s}  `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const g of smaller) if (larger.has(g)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

export async function findDuplicateProducts(threshold = 0.65, limit = 500): Promise<DuplicatePair[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      categoryId: true,
      brandId: true,
      priceRetail: true,
      quantity: true,
    },
    take: 5000,
  });

  // Precompute trigram sets and trigram→productId index
  const grams = new Map<number, Set<string>>();
  const inverted = new Map<string, number[]>();
  for (const p of products) {
    const g = trigrams(normalize(p.name));
    grams.set(p.id, g);
    for (const t of g) {
      const arr = inverted.get(t) ?? [];
      arr.push(p.id);
      inverted.set(t, arr);
    }
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const seenPair = new Set<string>();
  const pairs: DuplicatePair[] = [];

  for (const p of products) {
    const ownGrams = grams.get(p.id)!;
    // Candidate ids: union of products sharing at least one trigram (skip very common trigrams)
    const candidates = new Set<number>();
    for (const t of ownGrams) {
      const arr = inverted.get(t);
      if (!arr || arr.length > 50) continue; // common trigram → too many; skip
      for (const otherId of arr) {
        if (otherId !== p.id) candidates.add(otherId);
      }
    }

    for (const otherId of candidates) {
      const key = p.id < otherId ? `${p.id}:${otherId}` : `${otherId}:${p.id}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);

      const otherGrams = grams.get(otherId)!;
      const sim = jaccard(ownGrams, otherGrams);
      if (sim < threshold) continue;

      const other = byId.get(otherId)!;
      const reasons: string[] = [];
      if (p.categoryId && p.categoryId === other.categoryId) reasons.push('та сама категорія');
      if (p.brandId && p.brandId === other.brandId) reasons.push('той самий бренд');
      if (p.code && other.code && p.code.slice(0, 4) === other.code.slice(0, 4)) {
        reasons.push('префікс коду збігається');
      }

      pairs.push({
        a: { ...p, priceRetail: Number(p.priceRetail) },
        b: { ...other, priceRetail: Number(other.priceRetail) },
        similarity: Math.round(sim * 1000) / 1000,
        reasons,
      });

      if (pairs.length >= limit) break;
    }
    if (pairs.length >= limit) break;
  }

  pairs.sort((x, y) => y.similarity - x.similarity);
  return pairs;
}
