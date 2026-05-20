import { prisma } from '@/lib/prisma';
import { calculatePalletDeliveryCost } from '@/services/pallet-delivery';

export class PalletError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PalletError';
  }
}

const palletInclude = {
  orders: {
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          contactName: true,
          contactPhone: true,
          deliveryCity: true,
          deliveryAddress: true,
          totalAmount: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

export async function listPallets(filters: { status?: string } = {}) {
  const where = filters.status ? { status: filters.status as never } : {};
  const pallets = await prisma.pallet.findMany({
    where,
    include: palletInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  return pallets;
}

export async function getPalletById(id: number) {
  return prisma.pallet.findUnique({ where: { id }, include: palletInclude });
}

/**
 * Sum the total weight of all orders attached to a pallet. Falls back to a
 * conservative per-item average (0.3 kg) when Product.weightGrams is not set,
 * so the operator gets *some* number on screen instead of "—" everywhere.
 *
 * This is the same fallback the Nova Poshta TTN logic uses; keeping them
 * aligned means the pallet weight estimate matches what each TTN was billed at.
 */
export async function calculatePalletWeight(palletId: number): Promise<number> {
  const items = await prisma.orderItem.findMany({
    where: { order: { palletOrders: { some: { palletId } } } },
    select: {
      productCode: true,
      quantity: true,
      product: {
        select: {
          weightGrams: true,
          // Pull variants too — OrderItem.productCode == ProductVariant.sku
          // when the customer picked a variant. Variant weight overrides the
          // parent product's default.
          variants: {
            select: { sku: true, weightGrams: true },
          },
        },
      },
    },
  });
  let totalGrams = 0;
  for (const item of items) {
    const variant = item.product?.variants.find((v) => v.sku === item.productCode);
    const grams =
      variant?.weightGrams ?? item.product?.weightGrams ?? 300; // 300 g fallback
    totalGrams += grams * item.quantity;
  }
  return Math.round(totalGrams / 1000); // kg, rounded
}

export async function createPallet(data: {
  name: string;
  region?: string | null;
  carrier?: string | null;
  notes?: string | null;
  createdBy?: number;
}) {
  if (!data.name.trim()) throw new PalletError('Назва палети обовʼязкова', 400);
  return prisma.pallet.create({
    data: {
      name: data.name.trim(),
      region: data.region ?? null,
      carrier: data.carrier ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy ?? null,
    },
    include: palletInclude,
  });
}

export async function updatePallet(
  id: number,
  data: {
    name?: string;
    region?: string | null;
    carrier?: string | null;
    trackingNumber?: string | null;
    notes?: string | null;
    weightKg?: number | null;
    deliveryCost?: number | null;
  },
) {
  const pallet = await prisma.pallet.findUnique({ where: { id } });
  if (!pallet) throw new PalletError('Палету не знайдено', 404);
  return prisma.pallet.update({
    where: { id },
    data,
    include: palletInclude,
  });
}

/**
 * Move pallet through its lifecycle. Schema enum: forming → in_transit →
 * delivered. cancelled is terminal from any state.
 *
 * When transitioning to in_transit we stamp the orders inside the pallet to
 * `shipped` so the per-order timeline stays in sync — otherwise an admin
 * would have to flip each order manually after handing the pallet to the
 * carrier.
 */
export async function setPalletStatus(
  id: number,
  status: 'forming' | 'in_transit' | 'delivered' | 'cancelled',
  options?: { forceUnpacked?: boolean },
) {
  const pallet = await prisma.pallet.findUnique({
    where: { id },
    include: { orders: { select: { orderId: true } } },
  });
  if (!pallet) throw new PalletError('Палету не знайдено', 404);

  // Refuse to ship a pallet that still has items not packed — operator
  // probably forgot to mark some of them at the workbench. Pass
  // `forceUnpacked: true` from a UI confirm dialog to override.
  if (status === 'in_transit' && !options?.forceUnpacked && pallet.orders.length > 0) {
    const orderIds = pallet.orders.map((po) => po.orderId);
    const unpacked = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        status: { in: ['new_order', 'processing', 'confirmed', 'paid'] },
      },
      select: { orderNumber: true },
      take: 10,
    });
    if (unpacked.length > 0) {
      const list = unpacked.map((o) => `#${o.orderNumber}`).join(', ');
      throw new PalletError(
        `${unpacked.length} замовлень ще не упаковано: ${list}. Спочатку відмітьте їх у Pick & Pack або підтвердіть відправку (forceUnpacked).`,
        409,
      );
    }
  }

  const validTransitions: Record<string, string[]> = {
    forming: ['in_transit', 'cancelled'],
    in_transit: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  };
  if (!validTransitions[pallet.status].includes(status)) {
    throw new PalletError(
      `Неможливо перевести палету з "${pallet.status}" у "${status}"`,
      400,
    );
  }

  const updateData: Record<string, unknown> = { status };
  const now = new Date();
  if (status === 'in_transit') updateData.shippedAt = now;
  if (status === 'delivered') updateData.deliveredAt = now;

  const updated = await prisma.pallet.update({
    where: { id },
    data: updateData,
    include: palletInclude,
  });

  // Cascade order statuses for in_transit. Don't cascade for delivered —
  // each order may have a different delivery timeline once the carrier
  // splits the pallet (e.g. one returns, others are delivered).
  if (status === 'in_transit' && pallet.orders.length > 0) {
    await prisma.order.updateMany({
      where: {
        id: { in: pallet.orders.map((po) => po.orderId) },
        // Don't trample manually-cancelled orders.
        status: { notIn: ['cancelled', 'returned'] },
      },
      data: { status: 'shipped' },
    });
  }

  return updated;
}

export async function addOrdersToPallet(palletId: number, orderIds: number[]) {
  if (orderIds.length === 0) return getPalletById(palletId);
  const pallet = await prisma.pallet.findUnique({ where: { id: palletId } });
  if (!pallet) throw new PalletError('Палету не знайдено', 404);
  if (pallet.status !== 'forming') {
    throw new PalletError('Можна додавати замовлення лише до палет у статусі "Формується"', 400);
  }

  // Skip orders already on any pallet (FK-friendly idempotent add).
  const existing = await prisma.palletOrder.findMany({
    where: { orderId: { in: orderIds } },
    select: { orderId: true, palletId: true },
  });
  const alreadyOnAnotherPallet = existing
    .filter((e) => e.palletId !== palletId)
    .map((e) => e.orderId);
  if (alreadyOnAnotherPallet.length > 0) {
    throw new PalletError(
      `Замовлення вже на іншій палеті: ${alreadyOnAnotherPallet.join(', ')}`,
      409,
    );
  }
  const alreadyOnThisPallet = new Set(existing.filter((e) => e.palletId === palletId).map((e) => e.orderId));

  await prisma.palletOrder.createMany({
    data: orderIds
      .filter((id) => !alreadyOnThisPallet.has(id))
      .map((orderId, idx) => ({ palletId, orderId, sortOrder: idx })),
    skipDuplicates: true,
  });

  // Refresh estimated weight + cost using current config.
  const weightKg = await calculatePalletWeight(palletId);
  let deliveryCost: number | null = null;
  if (weightKg > 0 && pallet.region) {
    try {
      const calc = await calculatePalletDeliveryCost(weightKg, pallet.region);
      deliveryCost = calc.cost;
    } catch {
      // Region not in config or below min weight — leave cost as null.
    }
  }
  await prisma.pallet.update({
    where: { id: palletId },
    data: { weightKg, deliveryCost },
  });

  return getPalletById(palletId);
}

export async function removeOrderFromPallet(palletId: number, orderId: number) {
  const pallet = await prisma.pallet.findUnique({ where: { id: palletId } });
  if (!pallet) throw new PalletError('Палету не знайдено', 404);
  if (pallet.status !== 'forming') {
    throw new PalletError('Можна змінювати склад тільки в статусі "Формується"', 400);
  }
  await prisma.palletOrder.deleteMany({ where: { palletId, orderId } });
  const weightKg = await calculatePalletWeight(palletId);
  await prisma.pallet.update({ where: { id: palletId }, data: { weightKg } });
  return getPalletById(palletId);
}

export async function deletePallet(id: number) {
  const pallet = await prisma.pallet.findUnique({ where: { id } });
  if (!pallet) throw new PalletError('Палету не знайдено', 404);
  if (pallet.status === 'in_transit' || pallet.status === 'delivered') {
    throw new PalletError('Не можна видалити палету що вже в дорозі або доставлена', 400);
  }
  await prisma.pallet.delete({ where: { id } });
  return { deleted: true };
}
