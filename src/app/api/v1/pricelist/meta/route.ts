import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

/**
 * Lightweight metadata endpoint for the pricelist cards on /account/pricelist.
 * Returns the count of active products without generating the PDF.
 */
export const GET = withOptionalAuth(async (_request: NextRequest) => {
  try {
    const totalActive = await prisma.product.count({
      where: { isActive: true },
    });
    return successResponse({
      totalActive,
      // Pricelist is generated on-demand, so the data is always "fresh" — use
      // the most recent product update as a proxy for "last changed".
      lastUpdated: await getLastProductUpdate(),
    });
  } catch {
    return errorResponse('Не вдалося завантажити метадані прайс-листа', 500);
  }
});

async function getLastProductUpdate(): Promise<string | null> {
  const newest = await prisma.product.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });
  return newest?.updatedAt?.toISOString() || null;
}
