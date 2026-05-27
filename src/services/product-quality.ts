import { prisma } from '@/lib/prisma';

export interface ProductQualityIssue {
  productId: number;
  productSlug: string;
  productName: string;
  score: number;
  ordersCount: number;
  reasons: string[];
}

/**
 * Heuristic "quality score" for product descriptions — no AI call needed,
 * which means cheap to run for the entire catalog. We surface the 10 worst
 * descriptions among products that ARE selling — those are the highest-impact
 * candidates for owner attention (good demand, bad listing = direct conversion loss).
 *
 * Scoring criteria (each missing item -10 points, starting at 100):
 * - shortDescription >= 100 chars
 * - fullDescription contains <h3> with required sections (chars/safety/usage/faq)
 * - fullDescription >= 800 chars
 * - has at least 2 images
 * - has at least one <ul> in fullDescription
 * - has seoTitle and seoDescription
 * - has a primary brand
 * - fullDescription contains numbers/digits (concrete data)
 */
export async function getWorstQualityProducts(limit = 10): Promise<ProductQualityIssue[]> {
  // Only score products that have at least 1 sale in the last 90 days —
  // descriptions for non-sellers are not the bottleneck.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const candidates = await prisma.product.findMany({
    where: {
      isActive: true,
      orderItems: { some: { order: { createdAt: { gte: cutoff } } } },
    },
    include: {
      content: {
        select: {
          shortDescription: true,
          fullDescription: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
      images: { select: { id: true } },
      brand: { select: { id: true } },
      _count: { select: { orderItems: { where: { order: { createdAt: { gte: cutoff } } } } } },
    },
    take: 500, // bound the work — sort by quality after
  });

  const scored: ProductQualityIssue[] = candidates.map((p) => {
    const reasons: string[] = [];
    let score = 100;
    const short = p.content?.shortDescription ?? '';
    const full = p.content?.fullDescription ?? '';

    if (short.length < 100) {
      score -= 10;
      reasons.push('Короткий опис менше 100 символів');
    }
    if (full.length < 800) {
      score -= 15;
      reasons.push('Повний опис менше 800 символів');
    }
    if (!/<h3>/i.test(full)) {
      score -= 10;
      reasons.push('Немає підрозділів <h3>');
    }
    if (!/<ul>|<ol>/i.test(full)) {
      score -= 10;
      reasons.push('Немає списків переваг/особливостей');
    }
    if (!/\d/.test(full)) {
      score -= 10;
      reasons.push('Без цифр і конкретики');
    }
    if (!/застереж|безпеч|обережно|не можна|не використовувати/i.test(full)) {
      score -= 5;
      reasons.push('Немає секції безпеки/застережень');
    }
    if (!/питання|faq/i.test(full)) {
      score -= 10;
      reasons.push('Немає FAQ-блоку');
    }
    if (p.images.length < 2) {
      score -= 10;
      reasons.push(`Лише ${p.images.length} зображення`);
    }
    if (!p.content?.seoTitle || p.content.seoTitle.length < 30) {
      score -= 10;
      reasons.push('SEO Title відсутній або занадто короткий');
    }
    if (!p.content?.seoDescription || p.content.seoDescription.length < 100) {
      score -= 10;
      reasons.push('SEO Description відсутній або занадто короткий');
    }
    if (!p.brand) {
      score -= 5;
      reasons.push('Не вказано бренд');
    }
    score = Math.max(0, score);

    return {
      productId: p.id,
      productSlug: p.slug,
      productName: p.name,
      score,
      ordersCount: p._count.orderItems,
      reasons,
    };
  });

  // Lowest scores first, with order count as tie-breaker (bigger sellers = priority).
  scored.sort((a, b) => a.score - b.score || b.ordersCount - a.ordersCount);
  return scored.slice(0, limit);
}
