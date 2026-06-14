import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  notifyDropshipSuppliers,
  notifyDropshipForOrder,
  type DropshipLine,
} from './dropship-notify';
import { prisma } from '@/lib/prisma';
import { notifySupplierDropshipOrder } from '@/services/telegram';
import { sendEmail } from '@/services/email';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supplierChannel: { findMany: vi.fn() },
    order: { updateMany: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock('@/services/telegram', () => ({
  notifySupplierDropshipOrder: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/email', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const ORDER = {
  orderNumber: 'WEB-1',
  contactName: 'Іван',
  contactPhone: '+380501112233',
  deliveryMethod: 'nova_poshta',
  deliveryCity: 'Львів',
  deliveryAddress: null,
  deliveryWarehouseRef: 'Відділення №5',
};

const findMany = vi.mocked(prisma.supplierChannel.findMany);
const tgNotify = vi.mocked(notifySupplierDropshipOrder);
const email = vi.mocked(sendEmail);

beforeEach(() => vi.clearAllMocks());

describe('notifyDropshipSuppliers', () => {
  it('groups lines per supplier and notifies each via Telegram', async () => {
    const lines: DropshipLine[] = [
      { supplierId: 1, productName: 'A', supplierSku: 'A1', quantity: 2 },
      { supplierId: 2, productName: 'B', supplierSku: 'B1', quantity: 1 },
      { supplierId: 1, productName: 'C', supplierSku: 'C1', quantity: 3 },
      { supplierId: null, productName: 'OwnGoods', supplierSku: null, quantity: 5 },
    ];
    findMany.mockResolvedValue([
      { id: 1, name: 'Sup1', notifyTelegramChatId: '111', notifyEmail: null },
      { id: 2, name: 'Sup2', notifyTelegramChatId: '222', notifyEmail: null },
    ] as never);

    await notifyDropshipSuppliers(ORDER, lines);

    expect(tgNotify).toHaveBeenCalledTimes(2);
    const sup1Call = tgNotify.mock.calls.find((c) => c[0].supplierName === 'Sup1')![0];
    expect(sup1Call.items.map((i) => i.productName)).toEqual(['A', 'C']);
    expect(sup1Call.chatId).toBe('111');
  });

  it('returns early without a query when no line has a supplier', async () => {
    await notifyDropshipSuppliers(ORDER, [
      { supplierId: null, productName: 'X', supplierSku: null, quantity: 1 },
    ]);
    expect(findMany).not.toHaveBeenCalled();
    expect(tgNotify).not.toHaveBeenCalled();
  });

  it('uses email when the supplier has no Telegram chat', async () => {
    findMany.mockResolvedValue([
      { id: 1, name: 'Sup1', notifyTelegramChatId: null, notifyEmail: 'sup@x.com' },
    ] as never);

    await notifyDropshipSuppliers(ORDER, [
      { supplierId: 1, productName: 'A', supplierSku: 'A1', quantity: 2 },
    ]);

    expect(tgNotify).not.toHaveBeenCalled();
    expect(email).toHaveBeenCalledTimes(1);
    expect(email.mock.calls[0][0].to).toBe('sup@x.com');
    expect(email.mock.calls[0][0].subject).toContain('WEB-1');
  });

  it('warns and counts noChannel when a dropship supplier has no channel', async () => {
    const { logger } = await import('@/lib/logger');
    findMany.mockResolvedValue([
      { id: 1, name: 'Sup1', notifyTelegramChatId: null, notifyEmail: null },
    ] as never);

    const result = await notifyDropshipSuppliers(ORDER, [
      { supplierId: 1, productName: 'A', supplierSku: 'A1', quantity: 2 },
    ]);

    expect(result).toMatchObject({ suppliers: 1, sent: 0, failed: 0, noChannel: 1 });
    expect(tgNotify).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });

  it('counts a supplier as failed when its only channel errors', async () => {
    findMany.mockResolvedValue([
      { id: 1, name: 'Sup1', notifyTelegramChatId: '111', notifyEmail: null },
    ] as never);
    tgNotify.mockRejectedValueOnce(new Error('tg down'));

    const result = await notifyDropshipSuppliers(ORDER, [
      { supplierId: 1, productName: 'A', supplierSku: 'A1', quantity: 2 },
    ]);

    expect(result).toMatchObject({ suppliers: 1, sent: 0, failed: 1 });
  });

  it('does nothing when the linked suppliers are not in dropship mode', async () => {
    // findMany already filters by fulfillment: 'dropship', so a consignment-only
    // supplier set comes back empty.
    findMany.mockResolvedValue([] as never);

    await notifyDropshipSuppliers(ORDER, [
      { supplierId: 9, productName: 'A', supplierSku: 'A1', quantity: 2 },
    ]);

    expect(tgNotify).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });
});

describe('notifyDropshipForOrder (idempotent)', () => {
  it('claims the order then notifies its dropship lines', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      orderNumber: 'WEB-9',
      contactName: 'Іван',
      contactPhone: '+380501112233',
      deliveryMethod: 'nova_poshta',
      deliveryCity: 'Львів',
      deliveryAddress: null,
      deliveryWarehouseRef: 'ВД №5',
      items: [{ supplierId: 1, productName: 'A', quantity: 2, product: { supplierSku: 'A1' } }],
    } as never);
    findMany.mockResolvedValue([
      { id: 1, name: 'Sup1', notifyTelegramChatId: '111', notifyEmail: null },
    ] as never);

    await notifyDropshipForOrder(9);

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 9, dropshipNotifiedAt: null },
      data: expect.objectContaining({ dropshipNotifiedAt: expect.any(Date) }),
    });
    expect(tgNotify).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the order was already claimed (count 0)', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 } as never);

    await notifyDropshipForOrder(9);

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(tgNotify).not.toHaveBeenCalled();
  });

  it('releases the claim when NO supplier was reached (so it can retry)', async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      orderNumber: 'WEB-9',
      contactName: 'Іван',
      contactPhone: '+380501112233',
      deliveryMethod: 'nova_poshta',
      deliveryCity: 'Львів',
      deliveryAddress: null,
      deliveryWarehouseRef: 'ВД №5',
      items: [{ supplierId: 1, productName: 'A', quantity: 2, product: { supplierSku: 'A1' } }],
    } as never);
    findMany.mockResolvedValue([
      { id: 1, name: 'Sup1', notifyTelegramChatId: '111', notifyEmail: null },
    ] as never);
    tgNotify.mockRejectedValueOnce(new Error('tg down'));

    await notifyDropshipForOrder(9);

    // First call claims; a second updateMany resets dropshipNotifiedAt → null.
    expect(prisma.order.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.order.updateMany).toHaveBeenLastCalledWith({
      where: { id: 9 },
      data: { dropshipNotifiedAt: null },
    });
  });
});
