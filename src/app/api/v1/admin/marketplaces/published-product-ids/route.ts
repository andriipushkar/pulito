import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { MARKETPLACE_CHANNELS } from '@/services/marketplaces';
import { logger } from '@/lib/logger';

// Aggregated map of published product IDs per marketplace channel.
// ProductsTab needs the full set (not paginated) to compute the "Опублік."
// badge for any product on any channel. Doing this through the generic
// /publications endpoint forced a hard `limit=1000` on the client, which
// silently broke once the shop had >1000 successful publications.
export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const pubs = await prisma.publication.findMany({
      where: {
        status: 'published',
        productId: { not: null },
      },
      select: { productId: true, channels: true },
    });

    const result: Record<string, number[]> = {};
    const seen: Record<string, Set<number>> = {};
    for (const ch of MARKETPLACE_CHANNELS) {
      result[ch] = [];
      seen[ch] = new Set();
    }

    const mpSet = new Set<string>(MARKETPLACE_CHANNELS);

    for (const pub of pubs) {
      const productId = pub.productId;
      if (productId == null) continue;
      const channels = Array.isArray(pub.channels) ? (pub.channels as unknown[]) : [];
      for (const ch of channels) {
        if (typeof ch !== 'string' || !mpSet.has(ch)) continue;
        if (seen[ch].has(productId)) continue;
        seen[ch].add(productId);
        result[ch].push(productId);
      }
    }

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/marketplaces/published-product-ids] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
