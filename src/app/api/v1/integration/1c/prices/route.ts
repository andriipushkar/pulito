import { NextRequest } from 'next/server';
import { withApiKey } from '@/middleware/api-key-auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { oneCPriceUpdateSchema } from '@/validators/integration-1c';
import { updatePricesFrom1C } from '@/services/integration-1c';
import { prisma } from '@/lib/prisma';

/** POST /api/v1/integration/1c/prices — Update prices from 1C */
export const POST = withApiKey(['prices'])(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = oneCPriceUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid request body';
      return errorResponse(message, 422);
    }

    const sync = await prisma.integrationSync.create({
      data: {
        type: 'one_c',
        direction: 'import_sync',
        entityType: 'price',
        status: 'running',
        itemsTotal: parsed.data.prices.length,
        startedAt: new Date(),
      },
    });

    const result = await updatePricesFrom1C(parsed.data.prices);

    await prisma.integrationSync.update({
      where: { id: sync.id },
      data: {
        status: 'completed',
        itemsProcessed: result.processed,
        itemsFailed: result.failed,
        errorLog: result.errors.length > 0 ? result.errors : undefined,
        completedAt: new Date(),
      },
    });

    return successResponse(result, 200);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : 'Failed to update prices',
      500
    );
  }
});
