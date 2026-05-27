import { NextRequest } from 'next/server';
import { withApiKey } from '@/middleware/api-key-auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { oneCProductsImportSchema } from '@/validators/integration-1c';
import { importProductsFrom1C } from '@/services/integration-1c';
import { prisma } from '@/lib/prisma';

/** GET /api/v1/integration/1c/products — Export products for 1C */
export const GET = withApiKey(['products'])(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const limit = Math.min(1000, Math.max(1, Number(sp.get('limit')) || 100));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          code: true,
          name: true,
          priceRetail: true,
          priceWholesale: true,
          quantity: true,
          category: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    const items = products.map((p) => ({
      code: p.code,
      name: p.name,
      priceRetail: Number(p.priceRetail),
      priceWholesale: p.priceWholesale ? Number(p.priceWholesale) : null,
      quantity: p.quantity,
      category: p.category?.name ?? null,
    }));

    return successResponse({ items, total, page, limit });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to export products', 500);
  }
});

/** POST /api/v1/integration/1c/products — Import products from 1C */
export const POST = withApiKey(['products'])(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = oneCProductsImportSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid request body';
      return errorResponse(message, 422);
    }

    // Create sync log
    const sync = await prisma.integrationSync.create({
      data: {
        type: 'one_c',
        direction: 'import_sync',
        entityType: 'product',
        status: 'running',
        itemsTotal: parsed.data.products.length,
        startedAt: new Date(),
      },
    });

    const result = await importProductsFrom1C(parsed.data.products);
    // Differentiate "completed" (anything got through) from "failed" (zero
    // rows imported despite N being attempted). Previously every outcome
    // was marked `completed`, including catastrophic failures — admins
    // could see "✓ completed, items processed: 0 / 1000" and assume OK.
    const totalAttempted = parsed.data.products.length;
    const fullFail = totalAttempted > 0 && result.processed === 0;
    const syncStatus = fullFail ? 'failed' : 'completed';

    await prisma.integrationSync.update({
      where: { id: sync.id },
      data: {
        status: syncStatus,
        itemsProcessed: result.processed,
        itemsFailed: result.failed,
        errorLog: result.errors.length > 0 ? result.errors : undefined,
        completedAt: new Date(),
      },
    });

    if (fullFail) {
      // 5xx so the 1C client treats this as a retryable upstream error
      // instead of "succeeded with empty result". Body still carries the
      // detail counts so they're visible in the response logs.
      return errorResponse(
        `Жоден товар не імпортовано (${result.failed} помилок). Деталі в Адмін → Інтеграції.`,
        500,
      );
    }

    return successResponse(result, 200);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to import products', 500);
  }
});
