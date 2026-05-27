import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { createInternetDocument, NovaPoshtaError } from '@/services/nova-poshta';
import { pushTrackingSafe } from '@/services/marketplace-tracking';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const bulkSchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1).max(100),
});

interface BulkResult {
  ok: { orderId: number; orderNumber: string; trackingNumber: string }[];
  failed: { orderId: number; orderNumber: string; error: string }[];
}

/**
 * Create Nova Poshta TTNs for multiple orders in one request.
 * Skips orders that already have a TTN, are not nova_poshta, or are missing data.
 *
 * Restricted to admin role only. Managers create TTNs through the per-order
 * endpoint where they're scoped to their assigned orders.
 */
export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    // Read NP sender config once
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: 'delivery_nova_poshta_' } },
    });
    const config: Record<string, string> = {};
    for (const s of settings) config[s.key.replace('delivery_nova_poshta_', '')] = s.value;
    if (!config.api_key) {
      return errorResponse('Nova Poshta API key not configured', 400);
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: parsed.data.orderIds } },
      select: {
        id: true,
        orderNumber: true,
        contactName: true,
        contactPhone: true,
        deliveryCity: true,
        deliveryWarehouseRef: true,
        deliveryStreetRef: true,
        deliveryBuilding: true,
        deliveryFlat: true,
        deliveryMethod: true,
        trackingNumber: true,
        totalAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        items: {
          select: {
            productCode: true,
            quantity: true,
            product: {
              select: {
                weightGrams: true,
                // Variants override parent weight when OrderItem.productCode
                // matches variant.sku — matches the same precedence used by
                // calculatePalletWeight so the two stay consistent.
                variants: {
                  select: { sku: true, weightGrams: true },
                },
              },
            },
          },
        },
      },
    });

    const result: BulkResult = { ok: [], failed: [] };

    // Surface IDs that didn't come back from the DB (deleted, never existed,
    // user typo'd a URL). Without this the operator sees "Created 7 TTNs,
    // failed 1" while the other 2 silently vanish.
    const foundIds = new Set(orders.map((o) => o.id));
    for (const requestedId of parsed.data.orderIds) {
      if (!foundIds.has(requestedId)) {
        result.failed.push({
          orderId: requestedId,
          orderNumber: `#${requestedId}`,
          error: 'Замовлення не знайдено',
        });
      }
    }

    // Pre-validate everything that doesn't need a network call. Items that
    // pass validation are then processed in small parallel chunks against
    // the Nova Poshta API — sequential calls for 100 orders blew through the
    // nginx 60s default. Chunk size 5 keeps NP happy (their soft limit is
    // ~10 concurrent) and brings worst-case latency from ~150s to ~30s.
    const valid: typeof orders = [];
    for (const o of orders) {
      if (o.trackingNumber) {
        result.failed.push({ orderId: o.id, orderNumber: o.orderNumber, error: 'TTN вже існує' });
        continue;
      }
      if (o.deliveryMethod !== 'nova_poshta') {
        result.failed.push({ orderId: o.id, orderNumber: o.orderNumber, error: 'Не Нова Пошта' });
        continue;
      }
      const isD2D = !!o.deliveryStreetRef && !!o.deliveryBuilding;
      if (!o.deliveryCity || (!o.deliveryWarehouseRef && !isD2D)) {
        result.failed.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          error: 'Немає міста / відділення / адреси',
        });
        continue;
      }
      valid.push(o);
    }

    const CHUNK_SIZE = 5;

    // Exponential backoff on 429 / 5xx — Nova Poshta enforces a soft per-key
    // rate limit and the previous bulk loop counted those as permanent
    // failures, leaving the user with "3 of 10 created" when really the
    // last 5 just needed a 2-second wait.
    const callWithBackoff = async <T>(fn: () => Promise<T>): Promise<T> => {
      const delays = [800, 2000, 5000]; // ms — 3 retries, total ~8s
      let lastErr: unknown;
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastErr = err;
          const code = err instanceof NovaPoshtaError ? err.statusCode : 0;
          const retryable = code === 429 || (code >= 500 && code < 600);
          if (!retryable || attempt === delays.length) throw err;
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
      throw lastErr;
    };

    const processOne = async (o: (typeof valid)[number]) => {
      const isD2D = !!o.deliveryStreetRef && !!o.deliveryBuilding;
      // Validated above (city + warehouse-or-address are required), but the
      // chunked map loses that narrowing. Re-check here for the type checker.
      if (!o.deliveryCity) return;
      // Pin to a local const so the lambda closure preserves the narrowed
      // non-null type — accessing `o.deliveryCity` inside the callback would
      // re-widen back to `string | null`.
      const deliveryCity = o.deliveryCity;
      try {
        const isCOD = o.paymentMethod === 'cod' && o.paymentStatus !== 'paid';
        const ttn = await callWithBackoff(() =>
          createInternetDocument({
            senderRef: config.sender_ref || '',
            senderAddressRef: config.sender_warehouse_ref || '',
            senderContactRef: config.sender_ref || '',
            senderPhone: config.sender_phone || '',
            recipientName: o.contactName,
            recipientPhone: o.contactPhone,
            recipientCityRef: deliveryCity,
            recipientWarehouseRef: !isD2D ? (o.deliveryWarehouseRef ?? undefined) : undefined,
            recipientStreetRef: isD2D ? (o.deliveryStreetRef ?? undefined) : undefined,
            recipientBuilding: isD2D ? (o.deliveryBuilding ?? undefined) : undefined,
            recipientFlat: isD2D ? (o.deliveryFlat ?? undefined) : undefined,
            payerType: o.paymentStatus === 'paid' ? 'Sender' : 'Recipient',
            paymentMethod: o.paymentStatus === 'paid' ? 'NonCash' : 'Cash',
            cargoType: 'Parcel',
            // Prefer Product.weightGrams when set; fall back to 300g/unit
            // default for products without recorded weight. Min 0.5 kg satisfies
            // Nova Poshta validation (smallest billed parcel).
            weight: Math.max(
              0.5,
              o.items.reduce((sum, i) => {
                const variant = i.product?.variants?.find((v) => v.sku === i.productCode);
                const g = variant?.weightGrams ?? i.product?.weightGrams ?? 300;
                return sum + (g * i.quantity) / 1000;
              }, 0),
            ),
            seatsAmount: 1,
            description: `Замовлення #${o.orderNumber}`,
            cost: Number(o.totalAmount),
            serviceType: isD2D ? 'WarehouseDoors' : 'WarehouseWarehouse',
            codAmount: isCOD ? Number(o.totalAmount) : undefined,
          }),
        );

        await prisma.order.update({
          where: { id: o.id },
          data: { trackingNumber: ttn.intDocNumber },
        });

        void pushTrackingSafe(o.id, ttn.intDocNumber);

        result.ok.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          trackingNumber: ttn.intDocNumber,
        });
      } catch (err) {
        const isKnown = err instanceof NovaPoshtaError;
        const safeMsg = isKnown ? err.message : 'Помилка зовнішнього сервісу';
        // Log only known/safe errors; raw error goes to server logs only.
        logger.error('Bulk TTN failed', {
          orderId: o.id,
          errorKind: isKnown ? 'NovaPoshtaError' : 'unknown',
        });
        if (!isKnown) {
          logger.error('Bulk TTN raw error', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
        result.failed.push({ orderId: o.id, orderNumber: o.orderNumber, error: safeMsg });
      }
    };

    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const chunk = valid.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(processOne));
    }

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/orders/bulk-ttn] POST failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
