import { prisma } from '@/lib/prisma';

/**
 * Image-quality audit for the product catalog.
 *
 * Each product is checked for:
 *   - missingMain     — no image marked as main
 *   - noImages        — no images at all
 *   - tooSmall        — main image width or height < 800px
 *   - missingAlt      — main image has no alt text (or empty)
 *   - tooFew          — fewer than 3 images total (single-image listings convert worse)
 *
 * Owner reviews the report and reshoots problem listings. We only flag — no auto-fix.
 */

const MIN_DIMENSION = 800;
const MIN_IMAGES_PER_PRODUCT = 3;

export type ImageIssue =
  | 'noImages'
  | 'missingMain'
  | 'tooSmall'
  | 'missingAlt'
  | 'tooFew';

export interface ImageQualityReport {
  productId: number;
  name: string;
  code: string;
  issues: ImageIssue[];
  imageCount: number;
  mainImage: {
    id: number;
    width: number | null;
    height: number | null;
    altText: string | null;
    pathThumbnail: string | null;
  } | null;
}

export async function getImageQualityReport(limit = 500): Promise<ImageQualityReport[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      images: {
        select: {
          id: true,
          isMain: true,
          width: true,
          height: true,
          altText: true,
          pathThumbnail: true,
        },
      },
    },
    take: limit * 5,
  });

  const reports: ImageQualityReport[] = [];

  for (const p of products) {
    const issues: ImageIssue[] = [];
    const main = p.images.find((i) => i.isMain) ?? null;

    if (p.images.length === 0) issues.push('noImages');
    else {
      if (!main) issues.push('missingMain');
      if (p.images.length < MIN_IMAGES_PER_PRODUCT) issues.push('tooFew');
      if (main) {
        if (
          (main.width !== null && main.width < MIN_DIMENSION) ||
          (main.height !== null && main.height < MIN_DIMENSION)
        ) {
          issues.push('tooSmall');
        }
        if (!main.altText || main.altText.trim() === '') {
          issues.push('missingAlt');
        }
      }
    }

    if (issues.length === 0) continue;

    reports.push({
      productId: p.id,
      name: p.name,
      code: p.code,
      issues,
      imageCount: p.images.length,
      mainImage: main,
    });

    if (reports.length >= limit) break;
  }

  // Worst first: more issues, then noImages, then tooSmall
  const issueWeight: Record<ImageIssue, number> = {
    noImages: 100,
    missingMain: 50,
    tooSmall: 30,
    missingAlt: 10,
    tooFew: 5,
  };
  reports.sort(
    (a, b) =>
      b.issues.reduce((s, i) => s + issueWeight[i], 0) -
      a.issues.reduce((s, i) => s + issueWeight[i], 0),
  );

  return reports;
}
