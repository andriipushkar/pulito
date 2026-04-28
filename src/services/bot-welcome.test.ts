import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botWelcomeMessage: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { pickWelcomeMessage, recordWelcomeConversion } from './bot-welcome';

const mockFind = vi.mocked(prisma.botWelcomeMessage.findMany);
const mockUpdate = vi.mocked(prisma.botWelcomeMessage.update);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({} as never);
});

describe('pickWelcomeMessage', () => {
  it('returns null when no active variants', async () => {
    mockFind.mockResolvedValue([]);
    const result = await pickWelcomeMessage('telegram');
    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns the only variant and increments impressions', async () => {
    mockFind.mockResolvedValue([
      {
        id: 5,
        variant: 'A',
        messageText: 'Hi',
        messageImage: null,
        buttons: null,
        promoCode: null,
        promoLink: null,
      },
    ] as never);

    const result = await pickWelcomeMessage('telegram');
    expect(result?.id).toBe(5);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { impressions: { increment: 1 } },
    });
  });

  it('does not throw if impressions update fails', async () => {
    mockFind.mockResolvedValue([
      {
        id: 7,
        variant: 'A',
        messageText: 'Hi',
        messageImage: null,
        buttons: null,
        promoCode: null,
        promoLink: null,
      },
    ] as never);
    mockUpdate.mockRejectedValueOnce(new Error('db'));

    const result = await pickWelcomeMessage('telegram');
    expect(result?.id).toBe(7);
  });

  it('returns null when prisma throws', async () => {
    mockFind.mockRejectedValue(new Error('db'));
    expect(await pickWelcomeMessage('telegram')).toBeNull();
  });
});

describe('recordWelcomeConversion', () => {
  it('increments conversions for the welcome id', async () => {
    await recordWelcomeConversion(42);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { conversions: { increment: 1 } },
    });
  });

  it('swallows update errors', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('db'));
    await expect(recordWelcomeConversion(42)).resolves.toBeUndefined();
  });
});
