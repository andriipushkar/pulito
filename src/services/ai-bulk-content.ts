import { prisma } from '@/lib/prisma';
import { generateForProduct } from './ai-content';

// Bulk-fill EMPTY product content (full description, and short/SEO if blank)
// using the AI generator. generateForProduct falls back Claude→Gemini→rules,
// so this is FREE (deterministic rules) until AI keys are configured, and
// AI-quality once they are. Only fills blank fields — never overwrites
// human-written content. Batched + capped so a catalog import doesn't run up
// an unbounded AI bill in one call; call again to drain the rest.

const BATCH_CAP = 50;

const missingWhere = {
  isActive: true,
  OR: [
    { content: null },
    { content: { fullDescription: null } },
    { content: { fullDescription: '' } },
  ],
};

export async function bulkAiFillProductContent(limit = 20): Promise<{
  filled: number;
  total: number;
  remaining: number;
}> {
  const take = Math.min(Math.max(1, limit), BATCH_CAP);

  const remainingBefore = await prisma.product.count({ where: missingWhere });

  const products = await prisma.product.findMany({
    where: missingWhere,
    include: {
      category: { select: { name: true } },
      brand: { select: { name: true } },
      content: { select: { shortDescription: true, seoTitle: true } },
    },
    take,
  });

  let filled = 0;
  for (const p of products) {
    try {
      const gen = await generateForProduct({
        name: p.name,
        category: p.category?.name ?? null,
        brand: p.brand?.name ?? null,
        priceRetail: Number(p.priceRetail),
        shortDescription: p.content?.shortDescription ?? null,
      });

      await prisma.productContent.upsert({
        where: { productId: p.id },
        // Only touch blank fields. The query already targets empty
        // fullDescription; short/SEO are filled only when currently blank so a
        // human edit is never clobbered.
        update: {
          fullDescription: gen.fullDescription,
          ...(p.content?.shortDescription
            ? {}
            : { shortDescription: gen.shortDescription.slice(0, 200) }),
          ...(p.content?.seoTitle
            ? {}
            : { seoTitle: gen.seoTitle, seoDescription: gen.seoDescription }),
        },
        create: {
          productId: p.id,
          fullDescription: gen.fullDescription,
          shortDescription: gen.shortDescription.slice(0, 200),
          seoTitle: gen.seoTitle,
          seoDescription: gen.seoDescription,
        },
      });
      filled++;
    } catch {
      // Per-product failure (AI timeout / bad response) — skip; next run retries.
    }
  }

  return { filled, total: products.length, remaining: Math.max(0, remainingBefore - filled) };
}
