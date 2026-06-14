import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** One ordered line, tagged with the supplier that owns the product (null for
 *  the shop's own goods). */
export interface DropshipLine {
  supplierId: number | null;
  productName: string;
  supplierSku: string | null;
  quantity: number;
}

/** The order fields a supplier needs to fulfil and ship a dropship line. */
export interface DropshipOrderInfo {
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  deliveryMethod: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  deliveryWarehouseRef: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Outcome of a dropship notification pass, so the caller can decide whether to
 *  release the idempotency claim and retry. */
export interface DropshipNotifyResult {
  suppliers: number; // dropship suppliers owning lines in this order
  sent: number; // suppliers reached on at least one channel
  failed: number; // suppliers whose every configured channel errored
  noChannel: number; // suppliers with neither Telegram nor email configured
}

/**
 * Tell each dropship supplier about the lines in a new order that belong to
 * them, so they ship directly to the customer. Telegram is primary (the shop
 * bot → the supplier's chat), email is a fallback. Best-effort: each channel is
 * isolated with its own catch so one bad address never blocks the others or the
 * order. Suppliers in own_stock/consignment mode are skipped — we ship those.
 * Returns per-supplier counts; a supplier with NO channel is warned (not a
 * silent no-op) so a mis-configured dropshipper can't swallow orders.
 */
export async function notifyDropshipSuppliers(
  order: DropshipOrderInfo,
  lines: DropshipLine[],
): Promise<DropshipNotifyResult> {
  const empty: DropshipNotifyResult = { suppliers: 0, sent: 0, failed: 0, noChannel: 0 };
  const supplierLines = lines.filter((l) => l.supplierId != null);
  if (supplierLines.length === 0) return empty;

  const supplierIds = [...new Set(supplierLines.map((l) => l.supplierId as number))];
  const suppliers = await prisma.supplierChannel.findMany({
    where: { id: { in: supplierIds }, fulfillment: 'dropship' },
    select: { id: true, name: true, notifyTelegramChatId: true, notifyEmail: true },
  });
  if (suppliers.length === 0) return empty;

  const tg = await import('@/services/telegram');
  const result: DropshipNotifyResult = {
    suppliers: suppliers.length,
    sent: 0,
    failed: 0,
    noChannel: 0,
  };

  for (const supplier of suppliers) {
    const items = supplierLines.filter((l) => l.supplierId === supplier.id);

    if (!supplier.notifyTelegramChatId && !supplier.notifyEmail) {
      result.noChannel++;
      logger.warn('[dropship-notify] dropship supplier has no notification channel', {
        supplierId: supplier.id,
        supplierName: supplier.name,
        orderNumber: order.orderNumber,
      });
      continue;
    }

    let reached = false;

    if (supplier.notifyTelegramChatId) {
      try {
        await tg.notifySupplierDropshipOrder({
          chatId: supplier.notifyTelegramChatId,
          supplierName: supplier.name,
          order,
          items,
        });
        reached = true;
      } catch (err) {
        logger.error('[dropship-notify] telegram failed', {
          supplierId: supplier.id,
          error: String(err),
        });
      }
    }

    if (supplier.notifyEmail) {
      const itemsHtml = items
        .map(
          (i) =>
            `<li>${escapeHtml(i.productName)}${i.supplierSku ? ` (${escapeHtml(i.supplierSku)})` : ''} — ${i.quantity} шт.</li>`,
        )
        .join('');
      const address = [order.deliveryCity, order.deliveryAddress, order.deliveryWarehouseRef]
        .filter(Boolean)
        .join(', ');
      const { sendEmail } = await import('@/services/email');
      try {
        await sendEmail({
          to: supplier.notifyEmail,
          subject: `Нове дропшип-замовлення #${order.orderNumber}`,
          html:
            `<p>Замовлення <b>#${escapeHtml(order.orderNumber)}</b> містить ваші товари до відправки:</p>` +
            `<ul>${itemsHtml}</ul>` +
            `<p>Отримувач: ${escapeHtml(order.contactName)}, ${escapeHtml(order.contactPhone)}<br>` +
            `Доставка: ${escapeHtml(order.deliveryMethod)}${address ? `: ${escapeHtml(address)}` : ''}</p>`,
        });
        reached = true;
      } catch (err) {
        logger.error('[dropship-notify] email failed', {
          supplierId: supplier.id,
          error: String(err),
        });
      }
    }

    if (reached) result.sent++;
    else result.failed++;
  }

  return result;
}

/**
 * Notify dropship suppliers about an order, reading lines straight from the DB.
 * IDEMPOTENT: atomically claims `Order.dropshipNotifiedAt` first, so it is safe
 * to call from multiple trigger points (COD on create, prepaid on payment, a
 * manual "mark paid") — only the first call for a given order sends anything.
 */
export async function notifyDropshipForOrder(orderId: number): Promise<void> {
  // Claim the order: only the call that flips dropshipNotifiedAt from null wins.
  const claim = await prisma.order.updateMany({
    where: { id: orderId, dropshipNotifiedAt: null },
    data: { dropshipNotifiedAt: new Date() },
  });
  if (claim.count === 0) return; // already notified by an earlier trigger

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      contactName: true,
      contactPhone: true,
      deliveryMethod: true,
      deliveryCity: true,
      deliveryAddress: true,
      deliveryWarehouseRef: true,
      items: {
        where: { supplierId: { not: null } },
        select: {
          supplierId: true,
          productName: true,
          quantity: true,
          product: { select: { supplierSku: true } },
        },
      },
    },
  });
  if (!order || order.items.length === 0) return;

  const result = await notifyDropshipSuppliers(
    {
      orderNumber: order.orderNumber,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      deliveryMethod: order.deliveryMethod,
      deliveryCity: order.deliveryCity,
      deliveryAddress: order.deliveryAddress,
      deliveryWarehouseRef: order.deliveryWarehouseRef,
    },
    order.items.map((i) => ({
      supplierId: i.supplierId,
      productName: i.productName,
      supplierSku: i.product?.supplierSku ?? null,
      quantity: i.quantity,
    })),
  );

  // If NO supplier was reached (every channel failed, or none configured) the
  // pre-send claim would otherwise mark this order notified forever — a silent
  // fulfilment miss. Release the claim so the next trigger / manual action can
  // retry. Safe from double-sends: sent === 0 means nobody got a message yet.
  if (result.suppliers > 0 && result.sent === 0) {
    await prisma.order.updateMany({
      where: { id: orderId },
      data: { dropshipNotifiedAt: null },
    });
    logger.error('[dropship-notify] order not delivered to any supplier — claim released', {
      orderId,
      ...result,
    });
  }
}
