import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.hoisted(() => {
  process.env.VIBER_AUTH_TOKEN = 'test-viber-auth-token';
  process.env.APP_URL = 'http://localhost:3000';
});

const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    category: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    order: { findMany: vi.fn(), findFirst: vi.fn() },
    wishlistItem: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import type { MockPrismaClient } from '@/test/prisma-mock';

const mockPrisma = prisma as unknown as MockPrismaClient;
const mockRedis = vi.mocked(redis);

import { verifyViberSignature, handleViberEvent } from './viber';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
});

describe('verifyViberSignature', () => {
  it('should return true for valid signature', () => {
    const body = '{"event":"subscribed"}';
    const expected = crypto.createHmac('sha256', 'test-viber-auth-token').update(body).digest('hex');

    const result = verifyViberSignature(body, expected);

    expect(result).toBe(true);
  });

  it('should return false for invalid signature', () => {
    const body = '{"event":"subscribed"}';

    const result = verifyViberSignature(body, 'invalid-signature');

    expect(result).toBe(false);
  });

  it('should return false when signature does not match body', () => {
    const body = '{"event":"subscribed"}';
    const differentBody = '{"event":"message"}';
    const signature = crypto.createHmac('sha256', 'test-viber-auth-token').update(differentBody).digest('hex');

    const result = verifyViberSignature(body, signature);

    expect(result).toBe(false);
  });
});

describe('handleViberEvent', () => {
  describe('subscribed event', () => {
    it('should send welcome message when user subscribes', async () => {
      await handleViberEvent({
        event: 'subscribed',
        timestamp: Date.now(),
        user: { id: 'viber-user-1', name: 'Тарас' },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.receiver).toBe('viber-user-1');
      expect(callBody.text).toContain('Тарас');
      expect(callBody.text).toContain('Порошок');
    });
  });

  describe('catalog command', () => {
    it('should send category list when user sends "catalog"', async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { name: 'Засоби для прання', slug: 'prannnya' },
        { name: 'Засоби для миття посуду', slug: 'posud' },
      ] as never);
      mockRedis.setex.mockResolvedValue('OK' as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'catalog', type: 'text' },
      });

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isVisible: true, parentId: null },
        })
      );
      expect(fetchMock).toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Категорії');
    });

    it('should show empty catalog message when no categories exist', async () => {
      mockPrisma.category.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'catalog', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('порожній');
    });
  });

  describe('orders command', () => {
    it('should show orders for linked user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Тарас', role: 'client' } as never);
      mockPrisma.order.findMany.mockResolvedValue([
        { orderNumber: '1001', status: 'processing', totalAmount: 250.00, createdAt: new Date() },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'orders', type: 'text' },
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { viberUserId: 'viber-user-1' },
        select: { id: true, fullName: true, role: true },
      });
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('#1001');
    });

    it('should prompt account linking when user is not linked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'orders', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('увійдіть');
    });

    it('should show empty orders message when no orders exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Тарас', role: 'client' } as never);
      mockPrisma.order.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'orders', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('немає замовлень');
    });
  });

  describe('wishlist command', () => {
    it('should show wishlist for linked user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Тарас', role: 'client' } as never);
      mockPrisma.wishlistItem.findMany.mockResolvedValue([
        {
          product: {
            name: 'Fairy Original',
            slug: 'fairy-original',
            code: 'FR001',
            priceRetail: 89.90,
            imagePath: '/uploads/fairy.jpg',
          },
        },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'wishlist', type: 'text' },
      });

      expect(mockPrisma.wishlistItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wishlist: { userId: 1 } },
        })
      );
      // Should send text + rich media
      expect(fetchMock).toHaveBeenCalled();
    });

    it('should prompt account linking when user is not linked for wishlist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'wishlist', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('/link');
    });

    it('should show empty wishlist message', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Тарас', role: 'client' } as never);
      mockPrisma.wishlistItem.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'wishlist', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('порожній');
    });
  });

  describe('account linking flow', () => {
    it('should start account linking with /link command', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        fullName: 'Тарас',
        viberUserId: null,
      } as never);
      mockRedis.setex.mockResolvedValue('OK' as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/link user@example.com', type: 'text' },
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        select: { id: true, fullName: true, viberUserId: true },
      });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'viber:link:viber-user-1',
        600,
        expect.stringContaining('"email":"user@example.com"')
      );
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Код підтвердження');
    });

    it('should report already linked account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        fullName: 'Тарас',
        viberUserId: 'viber-user-1',
      } as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/link user@example.com', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain("вже прив'язано");
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should report account not found for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/link unknown@example.com', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('не знайдено');
    });

    it('should verify code and link account', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ email: 'user@example.com', code: '123456', userId: 1 }) as never
      );
      mockPrisma.user.update.mockResolvedValue({ id: 1, viberUserId: 'viber-user-1' } as never);
      mockRedis.del.mockResolvedValue(1 as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '123456', type: 'text' },
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { viberUserId: 'viber-user-1' },
      });
      expect(mockRedis.del).toHaveBeenCalledWith('viber:link:viber-user-1');
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain("успішно прив'язано");
    });

    it('should reject wrong verification code', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ email: 'user@example.com', code: '123456', userId: 1 }) as never
      );

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '654321', type: 'text' },
      });

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Невірний код');
    });

    it('should report expired code by falling through to search', async () => {
      mockRedis.get.mockResolvedValue(null as never);
      // When no pending code exists and text is 6 digits (length >= 2),
      // it falls through to product search
      mockPrisma.product.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '123456', type: 'text' },
      });

      // No account linking should happen
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      // Falls through to search instead
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });
  });

  describe('search fallback', () => {
    it('should treat unknown text as search query', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { name: 'Fairy Original', slug: 'fairy-original', priceRetail: 89.90 },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'Fairy', type: 'text' },
      });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'Fairy', mode: 'insensitive' } }),
            ]),
          }),
        })
      );
    });

    it('should show not found message for empty search results', async () => {
      mockPrisma.product.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'xyznonexistent', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('нічого не знайдено');
    });
  });

  describe('contact command', () => {
    it('should send contact information', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'contact', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Контакти');
      expect(callBody.text).toContain('Порошок');
    });
  });

  describe('error handling', () => {
    it('should silently catch errors for awaited handlers', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failure'));

      await expect(
        handleViberEvent({
          event: 'message',
          timestamp: Date.now(),
          sender: { id: 'viber-user-1', name: 'Тарас' },
          message: { text: '/link bademail', type: 'text' },
        })
      ).resolves.toBeUndefined();
    });

    it('should handle events without message text gracefully', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { type: 'picture' },
      });

      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    });
  });

  describe('promo command', () => {
    it('should show promo products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { name: 'Promo 1', slug: 'promo-1', code: 'PR1', priceRetail: 100, imagePath: '/img/pr1.jpg' },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'promo', type: 'text' },
      });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true, isPromo: true }),
        })
      );
      // Text message + rich media carousel = at least 2 fetch calls
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should show empty promo message when no products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'promo', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('немає активних акцій');
    });
  });

  describe('help/contact command', () => {
    it('should route "help" to contact handler', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'help', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Контакти');
    });
  });

  describe('settings/menu/main_menu command', () => {
    it('should route "settings" to welcome handler', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'settings', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Тарас');
    });

    it('should route "menu" to welcome handler', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'menu', type: 'text' },
      });

      expect(fetchMock).toHaveBeenCalled();
    });

    it('should route "main_menu" to welcome handler', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'main_menu', type: 'text' },
      });

      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('catalog pagination', () => {
    it('should handle catalog_next command', async () => {
      mockRedis.get.mockResolvedValue('1' as never);
      mockRedis.setex.mockResolvedValue('OK' as never);
      mockPrisma.category.findMany.mockResolvedValue([
        { name: 'Cat 1', slug: 'cat-1' },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'catalog_next', type: 'text' },
      });

      expect(mockRedis.get).toHaveBeenCalledWith('viber:catalog_page:viber-user-1');
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 6, // page 2: (2-1) * 6 = 6
        })
      );
    });

    it('should handle catalog_prev command', async () => {
      mockRedis.get.mockResolvedValue('3' as never);
      mockRedis.setex.mockResolvedValue('OK' as never);
      mockPrisma.category.findMany.mockResolvedValue([
        { name: 'Cat 1', slug: 'cat-1' },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'catalog_prev', type: 'text' },
      });

      // currentPage=3, prev = max(1, 3-1) = 2, skip = (2-1)*6 = 6
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 6,
        })
      );
    });

    it('should handle catalog_prev when no page stored (defaults to page 2)', async () => {
      mockRedis.get.mockResolvedValue(null as never);
      mockRedis.setex.mockResolvedValue('OK' as never);
      mockPrisma.category.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'catalog_prev', type: 'text' },
      });

      // Default is 2, so prev = max(1, 2-1) = 1 -> skip = 0
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });

    it('should show "has more" navigation when more categories exist', async () => {
      // Return 7 items (pageSize + 1) to trigger hasMore
      mockRedis.setex.mockResolvedValue('OK' as never);
      const categories = Array.from({ length: 7 }, (_, i) => ({
        name: `Cat ${i}`, slug: `cat-${i}`,
      }));
      mockPrisma.category.findMany.mockResolvedValue(categories as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'catalog', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const buttons = callBody.keyboard?.Buttons || [];
      const hasNext = buttons.some((b: { ActionBody: string }) => b.ActionBody === 'catalog_next');
      expect(hasNext).toBe(true);
    });
  });

  describe('FAQ commands', () => {
    it('should handle faq command - show categories', async () => {
      mockPrisma.faqItem = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } as never;
      vi.mocked(mockPrisma.faqItem.findMany).mockResolvedValue([
        { category: 'Доставка' },
        { category: 'Оплата' },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Часті питання');
    });

    it('should handle empty FAQ categories', async () => {
      mockPrisma.faqItem = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } as never;
      vi.mocked(mockPrisma.faqItem.findMany).mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('немає питань');
    });

    it('should handle faq_cat: command', async () => {
      mockPrisma.faqItem = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } as never;
      vi.mocked(mockPrisma.faqItem.findMany).mockResolvedValue([
        { id: 1, question: 'Як замовити?' },
      ] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq_cat:Доставка', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Доставка');
    });

    it('should handle empty faq_cat: category (no category)', async () => {
      // faq_cat: with empty category should not crash
      mockPrisma.product.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq_cat:', type: 'text' },
      });

      // Falls through to search since empty category is falsy
      expect(fetchMock).toHaveBeenCalled();
    });

    it('should handle faq_cat: with empty questions', async () => {
      mockPrisma.faqItem = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } as never;
      vi.mocked(mockPrisma.faqItem.findMany).mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq_cat:Empty', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('немає питань');
    });

    it('should handle faq_q: command and increment click', async () => {
      mockPrisma.faqItem = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } as never;
      vi.mocked(mockPrisma.faqItem.findUnique).mockResolvedValue({
        id: 1, question: 'How?', answer: 'Like this', category: 'General',
      } as never);
      vi.mocked(mockPrisma.faqItem.update).mockResolvedValue({} as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq_q:1', type: 'text' },
      });

      expect(mockPrisma.faqItem.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { clickCount: { increment: 1 } },
      });
    });

    it('should handle faq_q: when question not found', async () => {
      mockPrisma.faqItem = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } as never;
      vi.mocked(mockPrisma.faqItem.findUnique).mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq_q:999', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('не знайдено');
    });

    it('should handle faq_q: with NaN id (falls through to search)', async () => {
      mockPrisma.product.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'faq_q:abc', type: 'text' },
      });

      // Should fall through since isNaN(parseInt('abc')) is true
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('recommend command', () => {
    it('should send recommend message', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'recommend', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Порекомендуйте');
    });
  });

  describe('notification management', () => {
    it('should show notification settings for linked user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client' } as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'stop_notifications', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('Сповіщення');
    });

    it('should prompt linking for stop_notifications when not linked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'stop_notifications', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('/link');
    });

    it('should stop notifications when confirmed', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client' } as never);
      mockPrisma.user.findUnique.mockResolvedValue({ notificationPrefs: {} } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'stop_notif_confirm', type: 'text' },
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notificationPrefs: expect.objectContaining({
              viber_orders: false,
              viber_promo: false,
            }),
          }),
        })
      );
    });

    it('should prompt linking for stop_notif_confirm when not linked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'stop_notif_confirm', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('/link');
    });

    it('should start notifications', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client' } as never);
      mockPrisma.user.findUnique.mockResolvedValue({ notificationPrefs: { viber_orders: false } } as never);
      mockPrisma.user.update.mockResolvedValue({} as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/start_notifications', type: 'text' },
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notificationPrefs: expect.objectContaining({
              viber_orders: true,
              viber_promo: true,
            }),
          }),
        })
      );
    });

    it('should prompt linking for /start_notifications when not linked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/start_notifications', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('/link');
    });
  });

  describe('order tracking', () => {
    it('should show order tracking info for linked user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client' } as never);
      mockPrisma.order.findFirst.mockResolvedValue({
        orderNumber: 'ORD-100', status: 'shipped', totalAmount: 500,
        createdAt: new Date('2025-01-01'), trackingNumber: 'TN123', deliveryMethod: 'Nova Poshta',
      } as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/track ORD-100', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('ORD-100');
      expect(callBody.text).toContain('TN123');
    });

    it('should show order tracking without tracking number', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client' } as never);
      mockPrisma.order.findFirst.mockResolvedValue({
        orderNumber: 'ORD-101', status: 'processing', totalAmount: 200,
        createdAt: new Date('2025-01-01'), trackingNumber: null, deliveryMethod: 'Pickup',
      } as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/track ORD-101', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).not.toContain('ТТН');
    });

    it('should show order not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client' } as never);
      mockPrisma.order.findFirst.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/track FAKE', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('не знайдено');
    });

    it('should prompt linking for /track when not linked', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/track ORD-100', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('/link');
    });

    it('should not handle /track without order number', async () => {
      mockPrisma.product.findMany.mockResolvedValue([] as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/track ', type: 'text' },
      });

      // Falls through to search since trimmed order number is empty
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });

    it('should show unknown status label as-is', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client' } as never);
      mockPrisma.order.findFirst.mockResolvedValue({
        orderNumber: 'ORD-102', status: 'custom_status', totalAmount: 100,
        createdAt: new Date('2025-01-01'), trackingNumber: null, deliveryMethod: 'Pickup',
      } as never);

      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: '/track ORD-102', type: 'text' },
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toContain('custom_status');
    });
  });

  describe('unhandled events', () => {
    it('should ignore unsubscribed event', async () => {
      await handleViberEvent({
        event: 'unsubscribed',
        timestamp: Date.now(),
        user_id: 'viber-user-1',
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should ignore message without sender', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        message: { text: 'hello', type: 'text' },
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should handle short text (1 char) - falls through to nothing', async () => {
      await handleViberEvent({
        event: 'message',
        timestamp: Date.now(),
        sender: { id: 'viber-user-1', name: 'Тарас' },
        message: { text: 'a', type: 'text' },
      });

      // text.length < 2, nothing happens
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// sendViberNotification
// ---------------------------------------------------------------------------

import { sendViberNotification, sendProductPhotoToUser } from './viber';

describe('sendViberNotification', () => {
  it('should send notification to user with viberUserId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      viberUserId: 'viber-user-1',
    } as never);

    await sendViberNotification(1, 'Test Title', 'Test body');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.receiver).toBe('viber-user-1');
    expect(callBody.text).toContain('Test Title');
    expect(callBody.text).toContain('Test body');
  });

  it('should include link in notification text', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      viberUserId: 'viber-user-1',
    } as never);

    await sendViberNotification(1, 'Title', 'Body', '/orders/123');

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.text).toContain('/orders/123');
  });

  it('should not include link when not provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      viberUserId: 'viber-user-1',
    } as never);

    await sendViberNotification(1, 'Title', 'Body');

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.text).not.toContain('🔗');
  });

  it('should skip when user has no viberUserId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      viberUserId: null,
    } as never);

    await sendViberNotification(1, 'Title', 'Body');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should skip when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);

    await sendViberNotification(99, 'Title', 'Body');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// sendProductPhotoToUser
// ---------------------------------------------------------------------------

describe('sendProductPhotoToUser', () => {
  it('should send photo to user with viberUserId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      viberUserId: 'viber-user-1',
    } as never);

    const result = await sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.type).toBe('picture');
    expect(callBody.media).toBe('https://img.test/p.jpg');
    expect(callBody.text).toBe('caption');
  });

  it('should return false when user has no viberUserId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      viberUserId: null,
    } as never);

    const result = await sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(false);
  });

  it('should return false when sendPictureMessage throws', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      viberUserId: 'viber-user-1',
    } as never);
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    const result = await sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyViberSignature - no AUTH_TOKEN
// ---------------------------------------------------------------------------

describe('verifyViberSignature (no AUTH_TOKEN)', () => {
  it('should return true when AUTH_TOKEN is empty (dev mode)', async () => {
    vi.resetModules();
    delete process.env.VIBER_AUTH_TOKEN;

    const freshFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', freshFetch);

    const mod = await import('./viber');
    const result = mod.verifyViberSignature('any-body', 'any-signature');

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sendProductPhotoToUser (no AUTH_TOKEN)
// ---------------------------------------------------------------------------

describe('sendProductPhotoToUser (no AUTH_TOKEN)', () => {
  it('should return false when AUTH_TOKEN is empty', async () => {
    vi.resetModules();
    delete process.env.VIBER_AUTH_TOKEN;

    const freshFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', freshFetch);

    const mod = await import('./viber');
    const result = await mod.sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(false);
    expect(freshFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleLinkVerify - expired/null stored code (line 101-102)
// ---------------------------------------------------------------------------
describe('handleViberEvent - handleLinkVerify with expired code', () => {
  it('should show expired code message when stored code is null on second redis call', async () => {
    // First redis.get returns truthy (pending check at line 710), then
    // second redis.get returns null inside handleLinkVerify (line 99)
    mockRedis.get
      .mockResolvedValueOnce('truthy') // pending check
      .mockResolvedValueOnce(null);    // inside handleLinkVerify

    await handleViberEvent({
      event: 'message',
      timestamp: Date.now(),
      sender: { id: 'viber-user-1', name: 'Тарас' },
      message: { text: '999888', type: 'text' },
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.text).toContain('прострочено');
  });
});

// ---------------------------------------------------------------------------
// /link with non-email argument (line 705)
// ---------------------------------------------------------------------------
describe('handleViberEvent - /link with non-email argument', () => {
  it('should send usage instructions when /link argument has no @ symbol', async () => {
    await handleViberEvent({
      event: 'message',
      timestamp: Date.now(),
      sender: { id: 'viber-user-1', name: 'Тарас' },
      message: { text: '/link notanemail', type: 'text' },
    });

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.text).toContain('Використання');
    expect(callBody.text).toContain('/link');
  });
});
