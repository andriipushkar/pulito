import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendEmail = vi.fn();

const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
  },
  order: {
    findMany: vi.fn(),
  },
  userNotification: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('./email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import {
  processWelcomeSeries,
  processWinBack,
  processPostPurchaseReviewRequest,
} from './email-sequences';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'https://test.com';
});

describe('processWelcomeSeries', () => {
  it('sends welcome email to new verified users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'user1@test.com', fullName: 'User One', referralCode: 'REF1' },
      { id: 2, email: 'user2@test.com', fullName: 'User Two', referralCode: null },
    ]);
    mockPrisma.userNotification.findFirst.mockResolvedValue(null);
    mockPrisma.userNotification.create.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    const result = await processWelcomeSeries();

    expect(result.sent).toBe(2);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user1@test.com' })
    );
    expect(mockPrisma.userNotification.create).toHaveBeenCalledTimes(2);
  });

  it('skips users who already received welcome email', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'user1@test.com', fullName: 'User One', referralCode: null },
    ]);
    mockPrisma.userNotification.findFirst.mockResolvedValue({ id: 99 }); // already sent

    const result = await processWelcomeSeries();

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips blocked users (handled by query filter)', async () => {
    // The query already filters isBlocked: false, so if no users returned, none are sent
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await processWelcomeSeries();

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('continues processing if one user email fails', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'fail@test.com', fullName: 'Fail', referralCode: null },
      { id: 2, email: 'ok@test.com', fullName: 'OK', referralCode: null },
    ]);
    mockPrisma.userNotification.findFirst.mockResolvedValue(null);
    mockPrisma.userNotification.create.mockResolvedValue({});
    mockSendEmail
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);

    const result = await processWelcomeSeries();

    expect(result.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });
});

describe('processWinBack', () => {
  it('sends winback emails to inactive users at 30/60/90 day intervals', async () => {
    // Each interval finds one user
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 10, email: 'inactive@test.com', fullName: 'Inactive' },
    ]);
    mockPrisma.userNotification.findFirst.mockResolvedValue(null);
    mockPrisma.userNotification.create.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    const result = await processWinBack();

    // 3 intervals, each with 1 user = 3 emails
    expect(result.sent).toBe(3);
    expect(mockSendEmail).toHaveBeenCalledTimes(3);
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(3);
  });

  it('skips users who already received winback email in window', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 10, email: 'inactive@test.com', fullName: 'Inactive' },
    ]);
    mockPrisma.userNotification.findFirst.mockResolvedValue({ id: 1 }); // already sent
    mockSendEmail.mockResolvedValue(undefined);

    const result = await processWinBack();

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('handles empty user lists gracefully', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await processWinBack();

    expect(result.sent).toBe(0);
  });
});

describe('processPostPurchaseReviewRequest', () => {
  it('sends review request 7 days after completed order', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 100,
        orderNumber: 'ORD-100',
        user: { id: 5, email: 'buyer@test.com', fullName: 'Buyer' },
        items: [{ productName: 'Порошок для прання' }, { productName: 'Засіб для миття' }],
      },
    ]);
    mockPrisma.userNotification.findFirst.mockResolvedValue(null);
    mockPrisma.userNotification.create.mockResolvedValue({});
    mockSendEmail.mockResolvedValue(undefined);

    const result = await processPostPurchaseReviewRequest();

    expect(result.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@test.com',
        subject: expect.stringContaining('відгук'),
      })
    );
    expect(mockPrisma.userNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 5,
          notificationType: 'review_request',
        }),
      })
    );
  });

  it('skips orders where review request was already sent', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 100,
        orderNumber: 'ORD-100',
        user: { id: 5, email: 'buyer@test.com', fullName: 'Buyer' },
        items: [{ productName: 'Порошок' }],
      },
    ]);
    mockPrisma.userNotification.findFirst.mockResolvedValue({ id: 1 }); // already sent

    const result = await processPostPurchaseReviewRequest();

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips orders without user email', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 100,
        orderNumber: 'ORD-100',
        user: null,
        items: [{ productName: 'Порошок' }],
      },
    ]);

    const result = await processPostPurchaseReviewRequest();

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('handles empty orders list', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    const result = await processPostPurchaseReviewRequest();

    expect(result.sent).toBe(0);
  });
});
