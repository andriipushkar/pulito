import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { pushReturnDecision } from '@/services/marketplace-sync';
import { isMarketplacePlatform } from '@/services/marketplace-health';
import { logAudit } from '@/services/audit';
import { logger } from '@/lib/logger';

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'completed'] as const;
type Decision = (typeof VALID_STATUSES)[number];

export const PATCH = withRole('admin')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const returnId = Number(id);

      if (isNaN(returnId)) {
        return errorResponse('Невалідний ID повернення', 400);
      }

      const body = (await request.json()) as {
        status?: Decision;
        skipPush?: boolean;
        restockProducts?: boolean;
      };

      if (!body.status || !(VALID_STATUSES as readonly string[]).includes(body.status)) {
        return errorResponse(`Невалідний статус. Допустимі: ${VALID_STATUSES.join(', ')}`, 400);
      }

      const existing = await prisma.marketplaceReturn.findUnique({
        where: { id: returnId },
        include: {
          connection: { select: { platform: true } },
          order: {
            select: {
              id: true,
              items: { select: { productCode: true, quantity: true } },
            },
          },
        },
      });

      if (!existing) {
        return errorResponse('Повернення не знайдено', 404);
      }

      // Best-effort: push the decision back to the marketplace API. If the
      // remote call fails, the admin sees a warning but the local status is
      // still updated — so the UI doesn't get stuck. skipPush=true lets the
      // admin override the local status without notifying the marketplace
      // (useful when reconciling stale data).
      let pushWarning: string | null = null;
      const platform = existing.connection.platform;
      const shouldPush =
        !body.skipPush &&
        body.status !== 'pending' &&
        isMarketplacePlatform(platform);
      if (shouldPush) {
        const pushResult = await pushReturnDecision(
          platform as Parameters<typeof pushReturnDecision>[0],
          existing.externalReturnId,
          body.status as 'approved' | 'rejected' | 'completed',
        );
        if (!pushResult.success) pushWarning = pushResult.error || 'Помилка push';
      }

      // Restock: when admin completes a return AND opts in, return the order's
      // item quantities to inventory. Limitation: marketplace return payloads
      // rarely include per-item refund detail, so we restock the WHOLE order's
      // items. For partial returns admin should NOT pass restockProducts=true
      // and instead adjust stock manually.
      const restocked: { productCode: string; quantity: number }[] = [];
      if (
        body.status === 'completed' &&
        body.restockProducts === true &&
        existing.order?.items?.length
      ) {
        for (const item of existing.order.items) {
          if (!item.productCode) continue;
          const result = await prisma.product.updateMany({
            where: { code: item.productCode },
            data: { quantity: { increment: item.quantity } },
          });
          if (result.count > 0) {
            restocked.push({ productCode: item.productCode, quantity: item.quantity });
          }
        }

        if (restocked.length > 0) {
          // Fire-and-forget: propagate new stock to all marketplaces.
          void import('@/services/marketplace-sync').then((m) =>
            // Use a fake productId list via findMany since updateMany doesn't return rows
            prisma.product
              .findMany({
                where: { code: { in: restocked.map((r) => r.productCode) } },
                select: { id: true },
              })
              .then((rows) => m.syncProductsStockToMarketplaces(rows.map((r) => r.id)))
              .catch((err) => {
                logger.error('[returns/[id]] failed to push restock to marketplaces', {
                  error: err instanceof Error ? err.message : String(err),
                });
              }),
          );
        }
      }

      const updated = await prisma.marketplaceReturn.update({
        where: { id: returnId },
        data: { status: body.status },
        include: {
          connection: { select: { platform: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });

      // Audit trail — admins can later see who approved/rejected/completed a return.
      try {
        await logAudit({
          userId: user.id,
          actionType: 'rule_change',
          entityType: 'marketplace_return',
          entityId: returnId,
          details: {
            status: body.status,
            restockedItems: restocked.length,
            pushWarning,
          },
        });
      } catch {
        // best-effort
      }

      return successResponse({
        ...updated,
        pushWarning,
        restocked: restocked.length,
        restockedItems: restocked,
      });
    } catch (err) {
      logger.error('[admin/marketplaces/returns/[id]] PATCH failed', { error: err });
      return errorResponse('Помилка оновлення повернення', 500);
    }
  }
);
