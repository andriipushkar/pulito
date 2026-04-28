import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botAutoReply: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { findAutoReply } from './bot-auto-reply';

const mockFind = vi.mocked(prisma.botAutoReply.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findAutoReply', () => {
  it('returns null when text is empty', async () => {
    expect(await findAutoReply('telegram', '')).toBeNull();
    expect(await findAutoReply('telegram', '   ')).toBeNull();
    expect(await findAutoReply('telegram', null)).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns null when no rules', async () => {
    mockFind.mockResolvedValue([]);
    expect(await findAutoReply('telegram', 'hello')).toBeNull();
  });

  it('matches by keyword (case-insensitive substring)', async () => {
    mockFind.mockResolvedValue([
      {
        id: 1,
        triggerType: 'keyword',
        triggerText: 'доставка',
        responseText: 'Інфо про доставку',
        responseImage: null,
        buttons: null,
      },
    ] as never);

    const match = await findAutoReply('telegram', 'А скажіть, як буде ДОСТАВКА?');
    expect(match?.id).toBe(1);
    expect(match?.responseText).toBe('Інфо про доставку');
  });

  it('matches by exact', async () => {
    mockFind.mockResolvedValue([
      {
        id: 2,
        triggerType: 'exact',
        triggerText: 'привіт',
        responseText: 'Вітаю!',
        responseImage: null,
        buttons: null,
      },
    ] as never);

    expect(await findAutoReply('telegram', 'привіт')).not.toBeNull();
    expect(await findAutoReply('telegram', 'привіт всім')).toBeNull();
  });

  it('matches by regex', async () => {
    mockFind.mockResolvedValue([
      {
        id: 3,
        triggerType: 'regex',
        triggerText: '^/promo\\d+',
        responseText: 'Промо',
        responseImage: null,
        buttons: null,
      },
    ] as never);

    expect(await findAutoReply('telegram', '/promo10 текст')).not.toBeNull();
    expect(await findAutoReply('telegram', 'нічого')).toBeNull();
  });

  it('skips invalid regex rule', async () => {
    mockFind.mockResolvedValue([
      {
        id: 4,
        triggerType: 'regex',
        triggerText: '[unclosed',
        responseText: 'Won not match',
        responseImage: null,
        buttons: null,
      },
      {
        id: 5,
        triggerType: 'keyword',
        triggerText: 'help',
        responseText: 'Help text',
        responseImage: null,
        buttons: null,
      },
    ] as never);

    const match = await findAutoReply('telegram', 'I need help');
    expect(match?.id).toBe(5);
  });

  it('skips rules with empty triggerText', async () => {
    mockFind.mockResolvedValue([
      {
        id: 6,
        triggerType: 'keyword',
        triggerText: '',
        responseText: 'X',
        responseImage: null,
        buttons: null,
      },
    ] as never);

    expect(await findAutoReply('telegram', 'anything')).toBeNull();
  });

  it('respects priority ordering (highest first)', async () => {
    // Prisma already orders, so the test verifies first-match-wins logic
    mockFind.mockResolvedValue([
      {
        id: 10,
        triggerType: 'keyword',
        triggerText: 'price',
        responseText: 'High priority response',
        responseImage: null,
        buttons: null,
      },
      {
        id: 11,
        triggerType: 'keyword',
        triggerText: 'price',
        responseText: 'Low priority response',
        responseImage: null,
        buttons: null,
      },
    ] as never);

    const match = await findAutoReply('telegram', 'what is the price');
    expect(match?.id).toBe(10);
  });
});
