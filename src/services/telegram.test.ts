import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env vars BEFORE the telegram module is imported, so that
// BOT_TOKEN (captured at module level) is non-empty.
vi.hoisted(() => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_MANAGER_CHAT_ID = '12345';
  process.env.APP_URL = 'https://shop.test';
});

const fetchMock = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    category: { findMany: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn() },
    order: { findMany: vi.fn() },
    siteSetting: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import type { MockPrismaClient } from '@/test/prisma-mock';

const mockPrisma = prisma as unknown as MockPrismaClient;
const mockRedis = vi.mocked(redis);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true });
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_MANAGER_CHAT_ID = '12345';
  process.env.APP_URL = 'https://shop.test';
});

import {
  sendClientNotification,
  notifyManagerNewOrder,
  notifyClientStatusChange,
  notifyManagerFeedback,
  generateLinkToken,
  linkTelegramAccount,
  handleTelegramUpdate,
} from './telegram';

// ---------------------------------------------------------------------------
// sendClientNotification
// ---------------------------------------------------------------------------

describe('sendClientNotification', () => {
  it('should send a message to the given chatId', async () => {
    await sendClientNotification(999, 'Test Title', 'Test body');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/sendMessage');
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe(999);
    expect(body.text).toContain('Test Title');
    expect(body.text).toContain('Test body');
  });

  it('should include a link button when link is provided', async () => {
    await sendClientNotification(999, 'Title', 'Body', '/orders/123');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_markup).toBeDefined();
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe(
      'https://shop.test/orders/123',
    );
  });

  it('should not include reply_markup when link is not provided', async () => {
    await sendClientNotification(999, 'Title', 'Body');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_markup).toBeUndefined();
  });
});

// Test the early-return guard via a fresh module loaded without BOT_TOKEN.
describe('sendClientNotification (no BOT_TOKEN)', () => {
  it('should early return when BOT_TOKEN is empty', async () => {
    vi.resetModules();
    delete process.env.TELEGRAM_BOT_TOKEN;

    const freshFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', freshFetch);

    const mod = await import('./telegram');
    await mod.sendClientNotification(999, 'Title', 'Body');

    expect(freshFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// notifyManagerNewOrder
// ---------------------------------------------------------------------------

describe('notifyManagerNewOrder', () => {
  const order = {
    orderNumber: 'ORD-001',
    contactName: 'John Doe',
    contactPhone: '+380991112233',
    contactEmail: 'john@test.com',
    totalAmount: 1500.5,
    itemsCount: 3,
    clientType: 'retail',
    deliveryMethod: 'Nova Poshta',
    paymentMethod: 'Card',
  };

  it('should send formatted order notification to manager', async () => {
    await notifyManagerNewOrder(order);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/sendMessage');

    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe(12345);
    expect(body.text).toContain('#ORD-001');
    expect(body.text).toContain('John Doe');
    expect(body.text).toContain('+380991112233');
    expect(body.text).toContain('john@test.com');
    expect(body.text).toContain('1500.50');
    expect(body.text).toContain('Nova Poshta');
    expect(body.text).toContain('Card');
  });

  it('should label retail client type', async () => {
    await notifyManagerNewOrder(order);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Роздрібний');
  });

  it('should label wholesale client type', async () => {
    await notifyManagerNewOrder({ ...order, clientType: 'wholesale' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Оптовий');
  });

  it('should skip when no TELEGRAM_MANAGER_CHAT_ID', async () => {
    delete process.env.TELEGRAM_MANAGER_CHAT_ID;

    await notifyManagerNewOrder(order);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should not throw when fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    await expect(notifyManagerNewOrder(order)).resolves.toBeUndefined();
  });
});

describe('notifyManagerNewOrder (no BOT_TOKEN)', () => {
  it('should early return when BOT_TOKEN is empty', async () => {
    vi.resetModules();
    delete process.env.TELEGRAM_BOT_TOKEN;

    const freshFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', freshFetch);

    const mod = await import('./telegram');
    await mod.notifyManagerNewOrder({
      orderNumber: 'X',
      contactName: 'X',
      contactPhone: 'X',
      totalAmount: 0,
      itemsCount: 0,
      clientType: 'retail',
      deliveryMethod: 'X',
      paymentMethod: 'X',
    });

    expect(freshFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// notifyClientStatusChange
// ---------------------------------------------------------------------------

describe('notifyClientStatusChange', () => {
  it('should look up user and send status notification', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);

    await notifyClientStatusChange(1, 'ORD-002', 'processing', 'confirmed');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { telegramChatId: true },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_id).toBe(777);
    expect(body.text).toContain('#ORD-002');
    expect(body.text).toContain('Підтверджено');
  });

  it('should skip when user has no telegramChatId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: null,
    } as never);

    await notifyClientStatusChange(1, 'ORD-003', 'new_order', 'processing');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should skip when user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);

    await notifyClientStatusChange(99, 'ORD-004', 'new_order', 'processing');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should include tracking number when status is shipped', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);

    await notifyClientStatusChange(
      1,
      'ORD-005',
      'paid',
      'shipped',
      '20450000000001',
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Відправлено');
    expect(body.text).toContain('20450000000001');
    expect(body.text).toContain('ТТН');
  });

  it('should not include tracking number for non-shipped status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);

    await notifyClientStatusChange(
      1,
      'ORD-006',
      'new_order',
      'processing',
      '20450000000001',
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).not.toContain('ТТН');
  });

  it('should include cancellation text for cancelled status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);

    await notifyClientStatusChange(1, 'ORD-007', 'processing', 'cancelled');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Скасовано');
    expect(body.text).toContain('замовлення було скасовано');
  });

  it('should include thank-you text for completed status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);

    await notifyClientStatusChange(1, 'ORD-008', 'shipped', 'completed');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Завершено');
    expect(body.text).toContain('Дякуємо за покупку');
  });

  it('should include a link to account orders', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);

    await notifyClientStatusChange(1, 'ORD-009', 'new_order', 'confirmed');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe(
      'https://shop.test/account/orders',
    );
  });
});

// ---------------------------------------------------------------------------
// notifyManagerFeedback
// ---------------------------------------------------------------------------

describe('notifyManagerFeedback', () => {
  it('should send callback feedback to manager', async () => {
    await notifyManagerFeedback({
      type: 'callback',
      name: 'Jane',
      phone: '+380501234567',
      message: 'Please call me',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_id).toBe(12345);
    expect(body.text).toContain('Запит на зворотний дзвінок');
    expect(body.text).toContain('Jane');
    expect(body.text).toContain('+380501234567');
    expect(body.text).toContain('Please call me');
  });

  it('should send form feedback to manager', async () => {
    await notifyManagerFeedback({
      type: 'form',
      name: 'Bob',
      email: 'bob@test.com',
      subject: 'Question',
      message: 'Hello, I have a question about your products.',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Повідомлення зворотного зв');
    expect(body.text).toContain('Bob');
    expect(body.text).toContain('bob@test.com');
    expect(body.text).toContain('Question');
    expect(body.text).toContain('Hello, I have a question');
  });

  it('should skip when no TELEGRAM_MANAGER_CHAT_ID', async () => {
    delete process.env.TELEGRAM_MANAGER_CHAT_ID;

    await notifyManagerFeedback({
      type: 'form',
      name: 'X',
      message: 'Y',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should truncate long messages to 300 chars', async () => {
    const longMessage = 'A'.repeat(500);

    await notifyManagerFeedback({
      type: 'form',
      name: 'X',
      message: longMessage,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const textContent = body.text as string;
    const aCount = (textContent.match(/A/g) || []).length;
    expect(aCount).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// generateLinkToken
// ---------------------------------------------------------------------------

describe('generateLinkToken', () => {
  it('should store token in Redis with 600s expiry and return it', async () => {
    const token = await generateLinkToken(555);

    expect(typeof token).toBe('string');
    expect(token.length).toBe(32); // 16 random bytes -> 32 hex chars

    expect(mockRedis.setex).toHaveBeenCalledWith(
      `tg_link:${token}`,
      600,
      '555',
    );
  });

  it('should generate unique tokens on each call', async () => {
    const token1 = await generateLinkToken(1);
    const token2 = await generateLinkToken(2);

    expect(token1).not.toBe(token2);
  });
});

// ---------------------------------------------------------------------------
// linkTelegramAccount
// ---------------------------------------------------------------------------

describe('linkTelegramAccount', () => {
  it('should link account successfully when token is valid', async () => {
    mockRedis.get.mockResolvedValue('777' as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    const result = await linkTelegramAccount(1, 'valid-token');

    expect(result).toBe(true);

    expect(mockRedis.get).toHaveBeenCalledWith('tg_link:valid-token');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { telegramChatId: BigInt(777) },
    });

    expect(mockRedis.del).toHaveBeenCalledWith('tg_link:valid-token');

    // Should also send a confirmation message via fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_id).toBe(777);
    expect(body.text).toContain('успішно');
  });

  it('should return false for invalid/expired token', async () => {
    mockRedis.get.mockResolvedValue(null as never);

    const result = await linkTelegramAccount(1, 'expired-token');

    expect(result).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleTelegramUpdate
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate', () => {
  // Ensure isBotWithinSchedule returns true (no schedule setting = always on)
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should route /start command to start handler', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 100, first_name: 'Alice' },
        chat: { id: 100, type: 'private' },
        text: '/start',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_id).toBe(100);
    expect(body.text).toContain('Alice');
    expect(body.reply_markup).toBeDefined();
    expect(body.reply_markup.inline_keyboard).toBeDefined();
  });

  it('should route /catalog command to catalog handler', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 1, name: 'Category One', slug: 'cat-one' },
    ] as never);

    await handleTelegramUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: 200, first_name: 'Bob' },
        chat: { id: 200, type: 'private' },
        text: '/catalog',
        date: Date.now(),
      },
    });

    expect(mockPrisma.category.findMany).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_id).toBe(200);
    expect(body.text).toContain('категорію');
  });

  it('should route /search command with query', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { name: 'Soap', slug: 'soap', priceRetail: 99.99, code: 'SP1' },
    ] as never);

    await handleTelegramUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        from: { id: 300, first_name: 'Carol' },
        chat: { id: 300, type: 'private' },
        text: '/search soap',
        date: Date.now(),
      },
    });

    expect(mockPrisma.product.findMany).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
    // First call is the "results" header, second is the product
    const headerBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(headerBody.text).toContain('soap');
  });

  it('should treat plain text as search query', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 4,
      message: {
        message_id: 4,
        from: { id: 400, first_name: 'Dave' },
        chat: { id: 400, type: 'private' },
        text: 'shampoo',
        date: Date.now(),
      },
    });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: { contains: 'shampoo', mode: 'insensitive' },
            }),
          ]),
        }),
      }),
    );
  });

  it('should handle callback queries and route to catalog', async () => {
    mockPrisma.category.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 5,
      callback_query: {
        id: 'cb-1',
        from: { id: 500, first_name: 'Eve' },
        message: {
          message_id: 10,
          from: { id: 500, first_name: 'Eve' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'catalog',
      },
    });

    // Should call answerCallbackQuery
    const answerCall = fetchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('/answerCallbackQuery'),
    );
    expect(answerCall).toBeDefined();
    const answerBody = JSON.parse(answerCall![1].body);
    expect(answerBody.callback_query_id).toBe('cb-1');

    // Should also query categories
    expect(mockPrisma.category.findMany).toHaveBeenCalled();
  });

  it('should handle callback query for promo', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 6,
      callback_query: {
        id: 'cb-2',
        from: { id: 600, first_name: 'Frank' },
        message: {
          message_id: 20,
          from: { id: 600, first_name: 'Frank' },
          chat: { id: 600, type: 'private' },
          date: Date.now(),
        },
        data: 'promo',
      },
    });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, isPromo: true }),
      }),
    );
  });

  it('should handle inline queries for product search', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Cleaner',
        slug: 'cleaner',
        priceRetail: 50,
        code: 'CL1',
        imagePath: '/img/cl.jpg',
      },
    ] as never);

    await handleTelegramUpdate({
      update_id: 7,
      inline_query: {
        id: 'iq-1',
        from: { id: 700, first_name: 'Grace' },
        query: 'cleaner',
        offset: '',
      },
    });

    // Should call answerInlineQuery
    const inlineCall = fetchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('/answerInlineQuery'),
    );
    expect(inlineCall).toBeDefined();
    const inlineBody = JSON.parse(inlineCall![1].body);
    expect(inlineBody.inline_query_id).toBe('iq-1');
    expect(inlineBody.results).toHaveLength(1);
    expect(inlineBody.results[0].title).toBe('Cleaner');
  });

  it('should answer inline query with empty results for short queries', async () => {
    await handleTelegramUpdate({
      update_id: 8,
      inline_query: {
        id: 'iq-2',
        from: { id: 800, first_name: 'Heidi' },
        query: 'a',
        offset: '',
      },
    });

    const inlineCall = fetchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('/answerInlineQuery'),
    );
    expect(inlineCall).toBeDefined();
    const inlineBody = JSON.parse(inlineCall![1].body);
    expect(inlineBody.results).toEqual([]);
  });

  it('should ignore callback query without chatId or data', async () => {
    await handleTelegramUpdate({
      update_id: 9,
      callback_query: {
        id: 'cb-3',
        from: { id: 900, first_name: 'Ivan' },
        // no message -> no chatId
        data: 'catalog',
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should not throw on webhook errors', async () => {
    // Use a callback_query path which is fully awaited inside the try/catch.
    // The /start path uses `return handleStart(...)` (un-awaited return),
    // so errors from it propagate through the promise chain.
    mockPrisma.siteSetting.findUnique.mockRejectedValue(
      new Error('DB down'),
    );

    await expect(
      handleTelegramUpdate({
        update_id: 10,
        callback_query: {
          id: 'cb-err',
          from: { id: 1000, first_name: 'Judy' },
          message: {
            message_id: 10,
            from: { id: 1000, first_name: 'Judy' },
            chat: { id: 1000, type: 'private' },
            date: Date.now(),
          },
          data: 'catalog',
        },
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendProductPhotoToUser
// ---------------------------------------------------------------------------

import { sendProductPhotoToUser } from './telegram';

describe('sendProductPhotoToUser', () => {
  it('should send photo to user with telegramChatId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(999),
    } as never);

    const result = await sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'Product photo');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/sendPhoto');
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe(999);
    expect(body.photo).toBe('https://img.test/p.jpg');
    expect(body.caption).toBe('Product photo');
  });

  it('should return false when user has no telegramChatId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: null,
    } as never);

    const result = await sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should return false when user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);

    const result = await sendProductPhotoToUser(99, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(false);
  });

  it('should return false when sendPhoto throws', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(999),
    } as never);
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    const result = await sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(false);
  });
});

describe('sendProductPhotoToUser (no BOT_TOKEN)', () => {
  it('should return false when BOT_TOKEN is empty', async () => {
    vi.resetModules();
    delete process.env.TELEGRAM_BOT_TOKEN;

    const freshFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', freshFetch);

    const mod = await import('./telegram');
    const result = await mod.sendProductPhotoToUser(1, 'https://img.test/p.jpg', 'caption');

    expect(result).toBe(false);
    expect(freshFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// notifyClientStatusChange (no BOT_TOKEN)
// ---------------------------------------------------------------------------

describe('notifyClientStatusChange (no BOT_TOKEN)', () => {
  it('should early return when BOT_TOKEN is empty', async () => {
    vi.resetModules();
    delete process.env.TELEGRAM_BOT_TOKEN;

    const freshFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', freshFetch);

    const mod = await import('./telegram');
    await mod.notifyClientStatusChange(1, 'ORD-001', 'new', 'shipped');

    expect(freshFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// notifyClientStatusChange - fetch error
// ---------------------------------------------------------------------------

describe('notifyClientStatusChange - error handling', () => {
  it('should not throw when fetch fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    await expect(
      notifyClientStatusChange(1, 'ORD-010', 'new_order', 'confirmed')
    ).resolves.toBeUndefined();
  });

  it('should use raw status string when unknown status is provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      telegramChatId: BigInt(777),
    } as never);

    await notifyClientStatusChange(1, 'ORD-011', 'new', 'custom_status');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('custom_status');
  });
});

// ---------------------------------------------------------------------------
// notifyManagerFeedback - error handling
// ---------------------------------------------------------------------------

describe('notifyManagerFeedback - error handling', () => {
  it('should not throw when fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    await expect(
      notifyManagerFeedback({
        type: 'form',
        name: 'Test',
        message: 'Test message',
      })
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleTelegramUpdate - additional coverage
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - additional paths', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should route /menu command to start handler', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 100,
      message: {
        message_id: 100,
        from: { id: 100, first_name: 'Test' },
        chat: { id: 100, type: 'private' },
        text: '/menu',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Test');
  });

  it('should route /link command', async () => {
    mockRedis.setex.mockResolvedValue('OK' as never);

    await handleTelegramUpdate({
      update_id: 101,
      message: {
        message_id: 101,
        from: { id: 101, first_name: 'Test' },
        chat: { id: 101, type: 'private' },
        text: '/link',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain("прив'язки");
  });

  it('should route /promo command', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await handleTelegramUpdate({
      update_id: 102,
      message: {
        message_id: 102,
        from: { id: 102, first_name: 'Test' },
        chat: { id: 102, type: 'private' },
        text: '/promo',
        date: Date.now(),
      },
    });

    expect(mockPrisma.product.findMany).toHaveBeenCalled();
  });

  it('should route /new command', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 103,
      message: {
        message_id: 103,
        from: { id: 103, first_name: 'Test' },
        chat: { id: 103, type: 'private' },
        text: '/new',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should route /popular command', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 104,
      message: {
        message_id: 104,
        from: { id: 104, first_name: 'Test' },
        chat: { id: 104, type: 'private' },
        text: '/popular',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should route /feedback command', async () => {
    await handleTelegramUpdate({
      update_id: 105,
      message: {
        message_id: 105,
        from: { id: 105, first_name: 'Test' },
        chat: { id: 105, type: 'private' },
        text: '/feedback',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('відгук');
  });

  it('should route /settings command', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 106,
      message: {
        message_id: 106,
        from: { id: 106, first_name: 'Test' },
        chat: { id: 106, type: 'private' },
        text: '/settings',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should route /orders command', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 107,
      message: {
        message_id: 107,
        from: { id: 107, first_name: 'Test' },
        chat: { id: 107, type: 'private' },
        text: '/orders',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should route /help command', async () => {
    await handleTelegramUpdate({
      update_id: 108,
      message: {
        message_id: 108,
        from: { id: 108, first_name: 'Test' },
        chat: { id: 108, type: 'private' },
        text: '/help',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('/start');
    expect(body.text).toContain('/catalog');
  });

  it('should route /contact command', async () => {
    await handleTelegramUpdate({
      update_id: 109,
      message: {
        message_id: 109,
        from: { id: 109, first_name: 'Test' },
        chat: { id: 109, type: 'private' },
        text: '/contact',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Контакти');
  });

  it('should route /prices command', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 110,
      message: {
        message_id: 110,
        from: { id: 110, first_name: 'Test' },
        chat: { id: 110, type: 'private' },
        text: '/prices',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Оптові ціни доступні тільки');
  });

  it('should handle feedback submission when user is awaiting feedback', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);
    mockPrisma.feedback = { create: vi.fn().mockResolvedValue({} as never) } as never;

    // First trigger feedback mode
    await handleTelegramUpdate({
      update_id: 111,
      message: {
        message_id: 111,
        from: { id: 1111, first_name: 'Feedback' },
        chat: { id: 1111, type: 'private' },
        text: '/feedback',
        date: Date.now(),
      },
    });

    fetchMock.mockClear();

    // Now send feedback text
    await handleTelegramUpdate({
      update_id: 112,
      message: {
        message_id: 112,
        from: { id: 1111, first_name: 'Feedback' },
        chat: { id: 1111, type: 'private' },
        text: 'My feedback text',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle /cancel command in feedback mode', async () => {
    // Trigger feedback mode
    await handleTelegramUpdate({
      update_id: 113,
      message: {
        message_id: 113,
        from: { id: 2222, first_name: 'Cancel' },
        chat: { id: 2222, type: 'private' },
        text: '/feedback',
        date: Date.now(),
      },
    });

    fetchMock.mockClear();

    // Cancel
    await handleTelegramUpdate({
      update_id: 114,
      message: {
        message_id: 114,
        from: { id: 2222, first_name: 'Cancel' },
        chat: { id: 2222, type: 'private' },
        text: '/cancel',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('скасовано');
  });

  it('should do nothing on /cancel when not in feedback mode', async () => {
    await handleTelegramUpdate({
      update_id: 115,
      message: {
        message_id: 115,
        from: { id: 3333, first_name: 'NoFeedback' },
        chat: { id: 3333, type: 'private' },
        text: '/cancel',
        date: Date.now(),
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should ignore single-char text that is not a command', async () => {
    await handleTelegramUpdate({
      update_id: 116,
      message: {
        message_id: 116,
        from: { id: 4444, first_name: 'Short' },
        chat: { id: 4444, type: 'private' },
        text: 'a',
        date: Date.now(),
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should handle callback query with cat_ prefix (category products)', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await handleTelegramUpdate({
      update_id: 117,
      callback_query: {
        id: 'cb-cat',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 50,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'cat_5',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query with cat_products: prefix for paginated categories', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await handleTelegramUpdate({
      update_id: 118,
      callback_query: {
        id: 'cb-catprod',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 51,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'cat_products:5:10',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query with promo: prefix for paginated promos', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await handleTelegramUpdate({
      update_id: 119,
      callback_query: {
        id: 'cb-promo-page',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 52,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'promo:5',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for new', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 120,
      callback_query: {
        id: 'cb-new',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 53,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'new',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for popular', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 121,
      callback_query: {
        id: 'cb-popular',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 54,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'popular',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for feedback', async () => {
    await handleTelegramUpdate({
      update_id: 122,
      callback_query: {
        id: 'cb-feedback',
        from: { id: 5500, first_name: 'Test' },
        message: {
          message_id: 55,
          from: { id: 5500, first_name: 'Test' },
          chat: { id: 5500, type: 'private' },
          date: Date.now(),
        },
        data: 'feedback',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for orders', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 123,
      callback_query: {
        id: 'cb-orders',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 56,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'orders',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for contact', async () => {
    await handleTelegramUpdate({
      update_id: 124,
      callback_query: {
        id: 'cb-contact',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 57,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'contact',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for about (routes to contact)', async () => {
    await handleTelegramUpdate({
      update_id: 125,
      callback_query: {
        id: 'cb-about',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 58,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'about',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for settings', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 126,
      callback_query: {
        id: 'cb-settings',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 59,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'settings',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for settings_notif:on', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client', email: 'test@test.com' } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ notificationPrefs: {} } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    await handleTelegramUpdate({
      update_id: 127,
      callback_query: {
        id: 'cb-notif-on',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 60,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'settings_notif:on',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for settings_notif:off', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 1, fullName: 'Test', role: 'client', email: 'test@test.com' } as never);
    mockPrisma.user.findUnique.mockResolvedValue({ notificationPrefs: { telegram: true } } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    await handleTelegramUpdate({
      update_id: 128,
      callback_query: {
        id: 'cb-notif-off',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 61,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'settings_notif:off',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for link', async () => {
    mockRedis.setex.mockResolvedValue('OK' as never);

    await handleTelegramUpdate({
      update_id: 129,
      callback_query: {
        id: 'cb-link',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 62,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'link',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle callback query for menu (start handler)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 130,
      callback_query: {
        id: 'cb-menu',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 63,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'menu',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should ignore callback query without data', async () => {
    await handleTelegramUpdate({
      update_id: 131,
      callback_query: {
        id: 'cb-nodata',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 64,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should handle update with no message and no callback_query and no inline_query', async () => {
    await handleTelegramUpdate({
      update_id: 132,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should redirect to outside schedule for callback query when bot is outside schedule', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'bot_schedule',
      value: JSON.stringify({ enabled: true, startHour: 0, endHour: 1, timezone: 'UTC' }),
    } as never);

    await handleTelegramUpdate({
      update_id: 133,
      callback_query: {
        id: 'cb-sched',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 65,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'catalog',
      },
    });

    // answerCallbackQuery + outside schedule message
    expect(fetchMock).toHaveBeenCalled();
  });

  it('should redirect to outside schedule for message when bot is outside schedule', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'bot_schedule',
      value: JSON.stringify({ enabled: true, startHour: 0, endHour: 1, timezone: 'UTC' }),
    } as never);

    await handleTelegramUpdate({
      update_id: 134,
      message: {
        message_id: 134,
        from: { id: 500, first_name: 'Test' },
        chat: { id: 500, type: 'private' },
        text: '/catalog',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should handle schedule with config.enabled=false (always on)', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'bot_schedule',
      value: JSON.stringify({ enabled: false, startHour: 9, endHour: 18, timezone: 'UTC' }),
    } as never);
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await handleTelegramUpdate({
      update_id: 135,
      message: {
        message_id: 135,
        from: { id: 500, first_name: 'Test' },
        chat: { id: 500, type: 'private' },
        text: '/promo',
        date: Date.now(),
      },
    });

    // Should proceed normally
    expect(mockPrisma.product.findMany).toHaveBeenCalled();
  });

  it('should handle isBotWithinSchedule when JSON parse throws', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      key: 'bot_schedule',
      value: 'not valid json',
    } as never);
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await handleTelegramUpdate({
      update_id: 136,
      message: {
        message_id: 136,
        from: { id: 500, first_name: 'Test' },
        chat: { id: 500, type: 'private' },
        text: '/promo',
        date: Date.now(),
      },
    });

    // Should default to within schedule (returns true)
    expect(mockPrisma.product.findMany).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleStart - linked user with fullName
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleStart with linked user', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should greet linked user by their fullName', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1,
      fullName: 'Іван Петренко',
      role: 'client',
      email: 'ivan@test.com',
    } as never);

    await handleTelegramUpdate({
      update_id: 200,
      message: {
        message_id: 200,
        from: { id: 200, first_name: 'Ivan' },
        chat: { id: 200, type: 'private' },
        text: '/start',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Іван Петренко');
  });

  it('should greet linked user by firstName when fullName is empty', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1,
      fullName: '',
      role: 'client',
      email: 'ivan@test.com',
    } as never);

    await handleTelegramUpdate({
      update_id: 201,
      message: {
        message_id: 201,
        from: { id: 201, first_name: 'Ivan' },
        chat: { id: 201, type: 'private' },
        text: '/start',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Ivan');
  });
});

// ---------------------------------------------------------------------------
// handleCatalog - empty categories
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleCatalog empty', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should send empty catalog message when no categories', async () => {
    mockPrisma.category.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 202,
      message: {
        message_id: 202,
        from: { id: 202, first_name: 'Test' },
        chat: { id: 202, type: 'private' },
        text: '/catalog',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('порожній');
  });
});

// ---------------------------------------------------------------------------
// handleCategoryProducts - with products and pagination
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleCategoryProducts with products', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should display products with images and pagination', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Prod 1', slug: 'prod-1', priceRetail: 99.99, isPromo: true, code: 'P1', imagePath: '/img/p1.jpg' },
      { id: 2, name: 'Prod 2', slug: 'prod-2', priceRetail: 49.50, isPromo: false, code: 'P2', imagePath: null },
    ] as never);
    mockPrisma.product.count.mockResolvedValue(10 as never);

    await handleTelegramUpdate({
      update_id: 203,
      callback_query: {
        id: 'cb-cat-prod',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 70,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'cat_5',
      },
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3); // answerCallback + page header + products + navigation
  });

  it('should show "more products unavailable" when offset > 0 and no products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(5 as never);

    await handleTelegramUpdate({
      update_id: 204,
      callback_query: {
        id: 'cb-cat-prod-end',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 71,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'cat_products:5:10',
      },
    });

    const messages = fetchMock.mock.calls
      .filter((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('/sendMessage'))
      .map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).text);

    expect(messages.some((t: string) => t.includes('Більше товарів немає'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handlePromo - products with pagination and images
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handlePromo with products', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should display promo products with old price and pagination', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Promo 1', slug: 'promo-1', priceRetail: 80, priceRetailOld: 100, code: 'PR1', imagePath: '/img/pr1.jpg' },
    ] as never);
    mockPrisma.product.count.mockResolvedValue(10 as never);

    await handleTelegramUpdate({
      update_id: 205,
      callback_query: {
        id: 'cb-promo-full',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 72,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'promo',
      },
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should show "more promo unavailable" when offset > 0 and no products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(5 as never);

    await handleTelegramUpdate({
      update_id: 206,
      callback_query: {
        id: 'cb-promo-end',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 73,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'promo:5',
      },
    });

    const messages = fetchMock.mock.calls
      .filter((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('/sendMessage'))
      .map((c: unknown[]) => JSON.parse((c[1] as { body: string }).body).text);
    expect(messages.some((t: string) => t.includes('Більше акційних товарів немає'))).toBe(true);
  });

  it('should display promo product without old price', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Promo NoOld', slug: 'promo-noold', priceRetail: 50, priceRetailOld: null, code: 'PR2', imagePath: null },
    ] as never);
    mockPrisma.product.count.mockResolvedValue(1 as never);

    await handleTelegramUpdate({
      update_id: 207,
      callback_query: {
        id: 'cb-promo-noold',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 74,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'promo',
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleOrders - linked user with orders
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleOrders with orders', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should display user orders with emoji status', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Test', role: 'client', email: 'test@test.com',
    } as never);
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'O-001', status: 'shipped', totalAmount: 500, createdAt: new Date('2025-01-01') },
      { id: 2, orderNumber: 'O-002', status: 'unknown_status', totalAmount: 200, createdAt: new Date('2025-01-02') },
    ] as never);

    await handleTelegramUpdate({
      update_id: 208,
      message: {
        message_id: 208,
        from: { id: 208, first_name: 'Test' },
        chat: { id: 208, type: 'private' },
        text: '/orders',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('#O-001');
    expect(body.text).toContain('#O-002');
  });

  it('should show empty orders message', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Test', role: 'client', email: 'test@test.com',
    } as never);
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 209,
      message: {
        message_id: 209,
        from: { id: 209, first_name: 'Test' },
        chat: { id: 209, type: 'private' },
        text: '/orders',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('немає замовлень');
  });
});

// ---------------------------------------------------------------------------
// handleSearch - with results containing images
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleSearch with image results', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should display products with images via sendPhoto', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { name: 'Soap', slug: 'soap', priceRetail: 99.99, code: 'SP1', imagePath: '/img/soap.jpg' },
    ] as never);

    await handleTelegramUpdate({
      update_id: 210,
      message: {
        message_id: 210,
        from: { id: 210, first_name: 'Test' },
        chat: { id: 210, type: 'private' },
        text: '/search soap',
        date: Date.now(),
      },
    });

    const photoCall = fetchMock.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/sendPhoto'),
    );
    expect(photoCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// handleNew - with products
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleNew with products', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should display new products with images', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'New Item', slug: 'new-item', priceRetail: 100, code: 'N1', imagePath: '/img/new.jpg', createdAt: new Date() },
    ] as never);

    await handleTelegramUpdate({
      update_id: 211,
      message: {
        message_id: 211,
        from: { id: 211, first_name: 'Test' },
        chat: { id: 211, type: 'private' },
        text: '/new',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handlePopular - with products
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handlePopular with products', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should display popular products with images', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Popular', slug: 'popular', priceRetail: 50, code: 'POP1', imagePath: '/img/pop.jpg', ordersCount: 100 },
    ] as never);

    await handleTelegramUpdate({
      update_id: 212,
      message: {
        message_id: 212,
        from: { id: 212, first_name: 'Test' },
        chat: { id: 212, type: 'private' },
        text: '/popular',
        date: Date.now(),
      },
    });

    expect(fetchMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleSettings - linked user with telegram enabled
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleSettings with linked user', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should show settings with telegram enabled', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Test', role: 'client', email: 'test@test.com',
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      notificationPrefs: { telegram: true },
    } as never);

    await handleTelegramUpdate({
      update_id: 213,
      message: {
        message_id: 213,
        from: { id: 213, first_name: 'Test' },
        chat: { id: 213, type: 'private' },
        text: '/settings',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Увімкнено');
  });

  it('should show settings with telegram disabled', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Test', role: 'client', email: 'test@test.com',
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      notificationPrefs: { telegram: false },
    } as never);

    await handleTelegramUpdate({
      update_id: 214,
      message: {
        message_id: 214,
        from: { id: 214, first_name: 'Test' },
        chat: { id: 214, type: 'private' },
        text: '/settings',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Вимкнено');
  });

  it('should show settings with null notificationPrefs', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Test', role: 'client', email: 'test@test.com',
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      notificationPrefs: null,
    } as never);

    await handleTelegramUpdate({
      update_id: 215,
      message: {
        message_id: 215,
        from: { id: 215, first_name: 'Test' },
        chat: { id: 215, type: 'private' },
        text: '/settings',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // telegram defaults to true when not set
    expect(body.text).toContain('Увімкнено');
  });
});

// ---------------------------------------------------------------------------
// handleSettingsToggleNotification - no user
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleSettingsToggleNotification no user', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should do nothing when user not linked and toggle notification', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 216,
      callback_query: {
        id: 'cb-toggle',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 80,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'settings_notif:on',
      },
    });

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleWholesalePrices - wholesale user
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleWholesalePrices', () => {
  beforeEach(() => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);
  });

  it('should show wholesale prices for wholesale user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Wholesaler', role: 'wholesaler', email: 'w@test.com',
    } as never);
    mockPrisma.product.findMany.mockResolvedValue([
      { name: 'Prod', slug: 'prod', priceRetail: 100, priceWholesale: 80, code: 'W1' },
    ] as never);

    await handleTelegramUpdate({
      update_id: 217,
      message: {
        message_id: 217,
        from: { id: 217, first_name: 'Test' },
        chat: { id: 217, type: 'private' },
        text: '/prices',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Оптові ціни');
  });

  it('should show wholesale prices with null priceWholesale (uses retail)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Wholesaler', role: 'wholesaler', email: 'w@test.com',
    } as never);
    mockPrisma.product.findMany.mockResolvedValue([
      { name: 'Prod', slug: 'prod', priceRetail: 100, priceWholesale: null, code: 'W2' },
    ] as never);

    await handleTelegramUpdate({
      update_id: 218,
      message: {
        message_id: 218,
        from: { id: 218, first_name: 'Test' },
        chat: { id: 218, type: 'private' },
        text: '/prices',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('100.00');
  });

  it('should show empty wholesale prices message', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, fullName: 'Wholesaler', role: 'wholesaler', email: 'w@test.com',
    } as never);
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await handleTelegramUpdate({
      update_id: 219,
      message: {
        message_id: 219,
        from: { id: 219, first_name: 'Test' },
        chat: { id: 219, type: 'private' },
        text: '/prices',
        date: Date.now(),
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('тимчасово недоступні');
  });
});

// ---------------------------------------------------------------------------
// handleInlineQuery - products without imagePath
// ---------------------------------------------------------------------------

describe('handleTelegramUpdate - handleInlineQuery with no image', () => {
  it('should answer inline query with products that have no imagePath', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Soap', slug: 'soap', priceRetail: 50, code: 'S1', imagePath: null },
    ] as never);

    await handleTelegramUpdate({
      update_id: 220,
      inline_query: {
        id: 'iq-noimg',
        from: { id: 700, first_name: 'Test' },
        query: 'soap',
        offset: '',
      },
    });

    const inlineCall = fetchMock.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/answerInlineQuery'),
    );
    expect(inlineCall).toBeDefined();
    const body = JSON.parse(inlineCall![1].body);
    expect(body.results[0].thumb_url).toBeUndefined();
  });

  it('should answer inline query with empty query string', async () => {
    await handleTelegramUpdate({
      update_id: 221,
      inline_query: {
        id: 'iq-empty',
        from: { id: 700, first_name: 'Test' },
        query: '',
        offset: '',
      },
    });

    const inlineCall = fetchMock.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/answerInlineQuery'),
    );
    expect(inlineCall).toBeDefined();
    const body = JSON.parse(inlineCall![1].body);
    expect(body.results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// notifyManagerNewOrder - without contactEmail
// ---------------------------------------------------------------------------

describe('notifyManagerNewOrder - without contactEmail', () => {
  it('should filter out empty email line', async () => {
    await notifyManagerNewOrder({
      orderNumber: 'ORD-010',
      contactName: 'No Email',
      contactPhone: '+380999',
      totalAmount: 100,
      itemsCount: 1,
      clientType: 'retail',
      deliveryMethod: 'Courier',
      paymentMethod: 'Cash',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).not.toContain('📧');
  });
});

// ---------------------------------------------------------------------------
// Pagination back button (offset > 0) for category products
// ---------------------------------------------------------------------------
describe('handleTelegramUpdate - category products pagination back button', () => {
  it('should show back pagination when offset > 0 and products exist', async () => {
    const products = [
      { name: 'Soap', slug: 'soap', code: 'S01', priceRetail: 50, imagePath: null, isPromo: false },
    ];
    mockPrisma.product.findMany.mockResolvedValue(products as never);
    mockPrisma.product.count.mockResolvedValue(20 as never);
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 300,
      callback_query: {
        id: 'cb-back',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 51,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'cat_products:5:5',
      },
    });

    // Should have multiple calls: answerCallbackQuery + page header + product + navigation
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Promo pagination back button (offset > 0)
// ---------------------------------------------------------------------------
describe('handleTelegramUpdate - promo pagination back button', () => {
  it('should show back pagination for promo when offset > 0', async () => {
    const products = [
      { name: 'Promo', slug: 'promo-1', code: 'PR1', priceRetail: 100, imagePath: null, isPromo: true },
    ];
    mockPrisma.product.findMany.mockResolvedValue(products as never);
    mockPrisma.product.count.mockResolvedValue(20 as never);
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null as never);

    await handleTelegramUpdate({
      update_id: 301,
      callback_query: {
        id: 'cb-promo-back',
        from: { id: 500, first_name: 'Test' },
        message: {
          message_id: 52,
          from: { id: 500, first_name: 'Test' },
          chat: { id: 500, type: 'private' },
          date: Date.now(),
        },
        data: 'promo:5',
      },
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Webhook error catch (line 926)
// ---------------------------------------------------------------------------
describe('handleTelegramUpdate - error in message handler', () => {
  it('should catch errors in callback_query processing silently', async () => {
    // Make answerCallbackQuery (fetch) throw to trigger the outer catch block
    fetchMock.mockRejectedValueOnce(new Error('network failure'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(handleTelegramUpdate({
      update_id: 302,
      callback_query: {
        id: 'cq1',
        data: 'menu',
        from: { id: 600, first_name: 'Test' },
        message: {
          message_id: 100,
          chat: { id: 600, type: 'private' },
          date: Date.now(),
          from: { id: 600, first_name: 'Test' },
        } as any,
      },
    })).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith('Telegram webhook error:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
