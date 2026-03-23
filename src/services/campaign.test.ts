import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaignRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    campaignLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    emailTemplate: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('./email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'test-id', attempts: 1 }),
}));

vi.mock('./analytics-reports', () => ({
  getCustomerSegmentation: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { sendEmail } from './email';
import { getCustomerSegmentation } from './analytics-reports';
import { processCampaigns, createCampaignRule, shouldRunCampaign, CampaignError } from './campaign';

const ruleFindMany = prisma.campaignRule.findMany as ReturnType<typeof vi.fn>;
const ruleFindUnique = prisma.campaignRule.findUnique as ReturnType<typeof vi.fn>;
const ruleCreate = prisma.campaignRule.create as ReturnType<typeof vi.fn>;
const ruleUpdate = prisma.campaignRule.update as ReturnType<typeof vi.fn>;
const logFindMany = prisma.campaignLog.findMany as ReturnType<typeof vi.fn>;
const logCreate = prisma.campaignLog.create as ReturnType<typeof vi.fn>;
const templateFindUnique = prisma.emailTemplate.findUnique as ReturnType<typeof vi.fn>;
const userFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;
const mockGetSegmentation = getCustomerSegmentation as ReturnType<typeof vi.fn>;
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shouldRunCampaign', () => {
  it('returns false for inactive rules', () => {
    const rule = { isActive: false, frequency: 'weekly', lastRunAt: null } as any;
    expect(shouldRunCampaign(rule)).toBe(false);
  });

  it('returns true for "once" frequency never run', () => {
    const rule = { isActive: true, frequency: 'once', lastRunAt: null } as any;
    expect(shouldRunCampaign(rule)).toBe(true);
  });

  it('returns false for "once" frequency already run', () => {
    const rule = { isActive: true, frequency: 'once', lastRunAt: new Date() } as any;
    expect(shouldRunCampaign(rule)).toBe(false);
  });

  it('returns true for recurring frequency never run', () => {
    const rule = { isActive: true, frequency: 'weekly', lastRunAt: null } as any;
    expect(shouldRunCampaign(rule)).toBe(true);
  });

  it('returns false for weekly frequency run 3 days ago', () => {
    const lastRun = new Date();
    lastRun.setDate(lastRun.getDate() - 3);
    const rule = { isActive: true, frequency: 'weekly', lastRunAt: lastRun } as any;
    expect(shouldRunCampaign(rule)).toBe(false);
  });

  it('returns true for weekly frequency run 8 days ago', () => {
    const lastRun = new Date();
    lastRun.setDate(lastRun.getDate() - 8);
    const rule = { isActive: true, frequency: 'weekly', lastRunAt: lastRun } as any;
    expect(shouldRunCampaign(rule)).toBe(true);
  });
});

describe('createCampaignRule', () => {
  it('validates that email template exists', async () => {
    templateFindUnique.mockResolvedValue(null);

    await expect(createCampaignRule({
      name: 'Test',
      rfmSegment: 'champions',
      emailTemplateId: 999,
    })).rejects.toThrow(CampaignError);
  });

  it('creates a campaign rule when template exists', async () => {
    templateFindUnique.mockResolvedValue({ id: 1, subject: 'Test', isActive: true });
    ruleCreate.mockResolvedValue({
      id: 1,
      name: 'Test',
      rfmSegment: 'champions',
      emailTemplateId: 1,
      frequency: 'once',
      isActive: true,
    });

    const result = await createCampaignRule({
      name: 'Test',
      rfmSegment: 'champions',
      emailTemplateId: 1,
    });

    expect(ruleCreate).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Test');
  });
});

describe('processCampaigns', () => {
  it('sends emails to correct segment', async () => {
    const now = new Date();
    ruleFindMany.mockResolvedValue([
      {
        id: 1,
        name: 'Win back lost',
        rfmSegment: 'lost',
        frequency: 'once',
        isActive: true,
        lastRunAt: null,
        emailTemplate: {
          id: 1,
          subject: 'We miss you',
          bodyHtml: '<p>Hello {{fullName}}</p>',
          bodyText: null,
          isActive: true,
        },
      },
    ]);

    mockGetSegmentation.mockResolvedValue({
      segments: [
        {
          segment: 'lost',
          label: 'Втрачені',
          count: 2,
          revenue: 0,
          avgCheck: 0,
          customers: [
            { userId: 10, email: 'a@test.com', fullName: 'User A', lastOrderDays: 400, orderCount: 1, totalSpent: 100 },
            { userId: 20, email: 'b@test.com', fullName: 'User B', lastOrderDays: 500, orderCount: 2, totalSpent: 200 },
          ],
        },
      ],
      totalCustomers: 2,
      totalRevenue: 300,
    });

    logFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([
      { id: 10, email: 'a@test.com', fullName: 'User A' },
      { id: 20, email: 'b@test.com', fullName: 'User B' },
    ]);
    logCreate.mockResolvedValue({});
    ruleUpdate.mockResolvedValue({});

    const result = await processCampaigns();

    expect(result.sent).toBe(2);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@test.com',
      subject: 'We miss you',
    }));
    expect(logCreate).toHaveBeenCalledTimes(2);
    expect(ruleUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: { lastRunAt: expect.any(Date) },
    }));
  });

  it('skips users who already received campaign', async () => {
    ruleFindMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test',
        rfmSegment: 'lost',
        frequency: 'once',
        isActive: true,
        lastRunAt: null,
        emailTemplate: {
          id: 1,
          subject: 'Test',
          bodyHtml: '<p>Hi</p>',
          bodyText: null,
          isActive: true,
        },
      },
    ]);

    mockGetSegmentation.mockResolvedValue({
      segments: [
        {
          segment: 'lost',
          label: 'Втрачені',
          count: 2,
          revenue: 0,
          avgCheck: 0,
          customers: [
            { userId: 10, email: 'a@test.com', fullName: 'A', lastOrderDays: 400, orderCount: 1, totalSpent: 100 },
            { userId: 20, email: 'b@test.com', fullName: 'B', lastOrderDays: 500, orderCount: 2, totalSpent: 200 },
          ],
        },
      ],
      totalCustomers: 2,
      totalRevenue: 300,
    });

    // User 10 already received this campaign
    logFindMany.mockResolvedValue([{ userId: 10 }]);
    userFindMany.mockResolvedValue([
      { id: 20, email: 'b@test.com', fullName: 'B' },
    ]);
    logCreate.mockResolvedValue({});
    ruleUpdate.mockResolvedValue({});

    const result = await processCampaigns();

    expect(result.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'b@test.com' }));
  });

  it('respects frequency and does not re-run too early', async () => {
    const lastRun = new Date();
    lastRun.setDate(lastRun.getDate() - 3); // 3 days ago

    ruleFindMany.mockResolvedValue([
      {
        id: 1,
        name: 'Weekly',
        rfmSegment: 'at_risk',
        frequency: 'weekly',
        isActive: true,
        lastRunAt: lastRun,
        emailTemplate: { id: 1, subject: 'Test', bodyHtml: '<p>Hi</p>', bodyText: null, isActive: true },
      },
    ]);

    mockGetSegmentation.mockResolvedValue({
      segments: [],
      totalCustomers: 0,
      totalRevenue: 0,
    });

    const result = await processCampaigns();

    // Rule should be skipped because only 3 days have passed (weekly = 7 days)
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
