import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { createInternetDocument, NovaPoshtaError } from '@/services/nova-poshta';
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
        items: { select: { quantity: true } },
      },
    });

    const result: BulkResult = { ok: [], failed: [] };

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

      try {
        const isCOD = o.paymentMethod === 'cod' && o.paymentStatus !== 'paid';
        const ttn = await createInternetDocument({
          senderRef: config.sender_ref || '',
          senderAddressRef: config.sender_warehouse_ref || '',
          senderContactRef: config.sender_ref || '',
          senderPhone: config.sender_phone || '',
          recipientName: o.contactName,
          recipientPhone: o.contactPhone,
          recipientCityRef: o.deliveryCity,
          recipientWarehouseRef: !isD2D ? (o.deliveryWarehouseRef ?? undefined) : undefined,
          recipientStreetRef: isD2D ? (o.deliveryStreetRef ?? undefined) : undefined,
          recipientBuilding: isD2D ? (o.deliveryBuilding ?? undefined) : undefined,
          recipientFlat: isD2D ? (o.deliveryFlat ?? undefined) : undefined,
          payerType: o.paymentStatus === 'paid' ? 'Sender' : 'Recipient',
          paymentMethod: o.paymentStatus === 'paid' ? 'NonCash' : 'Cash',
          cargoType: 'Parcel',
          weight: Math.max(
            0.5,
            o.items.reduce((sum, i) => sum + i.quantity * 0.3, 0),
          ),
          seatsAmount: 1,
          description: `Замовлення #${o.orderNumber}`,
          cost: Number(o.totalAmount),
          serviceType: isD2D ? 'WarehouseDoors' : 'WarehouseWarehouse',
          codAmount: isCOD ? Number(o.totalAmount) : undefined,
        });

        await prisma.order.update({
          where: { id: o.id },
          data: { trackingNumber: ttn.intDocNumber },
        });

        result.ok.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          trackingNumber: ttn.intDocNumber,
        });
      } catch (err) {
        const msg = err instanceof NovaPoshtaError ? err.message : String(err);
        logger.error('Bulk TTN failed', { orderNumber: o.orderNumber, error: msg });
        result.failed.push({ orderId: o.id, orderNumber: o.orderNumber, error: msg });
      }
    }

    return successResponse(result);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
