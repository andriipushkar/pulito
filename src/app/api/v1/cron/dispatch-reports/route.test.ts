import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    APP_SECRET: 'test-app-secret-32-chars-minimum-aaaaaa',
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    APP_URL: 'https://test.com',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    UPLOAD_DIR: '/tmp/test-uploads',
  },
}));

// Route dynamically imports the report generator to attach an XLSX; mock it so
// the test doesn't spawn the real (heavy, DB+fs) generator and hang under
// fake timers. Returning a url with no real file leaves attachments empty.
vi.mock('@/services/report-generator', () => ({
  generateReport: vi.fn().mockResolvedValue({ url: '/uploads/reports/none.xlsx' }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    reportTemplate: { findMany: vi.fn() },
    order: { count: vi.fn(), aggregate: vi.fn() },
    user: { count: vi.fn() },
  },
}));
const sendEmailMock = vi.fn();
vi.mock('@/services/email', () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

const VALID_AUTH = 'Bearer test-app-secret-32-chars-minimum-aaaaaa';

function reqAt(date: Date) {
  // We can't easily inject `now` — but the route uses `new Date()`. So we
  // freeze the system clock for each scenario.
  vi.useFakeTimers();
  vi.setSystemTime(date);
  return new Request('http://localhost/cron', {
    method: 'POST',
    headers: { authorization: VALID_AUTH },
  });
}

describe('POST /api/v1/cron/dispatch-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmailMock.mockResolvedValue(undefined);
    vi.mocked(prisma.order.count).mockResolvedValue(0);
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    vi.mocked(prisma.order.aggregate).mockResolvedValue({
      _sum: { totalAmount: 0 },
    } as any);
  });

  it('rejects unauthorized callers', async () => {
    vi.mocked(prisma.reportTemplate.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost/cron', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(401);
    expect(prisma.reportTemplate.findMany).not.toHaveBeenCalled();
  });

  it('skips daily report when hour ≠ 06 UTC', async () => {
    vi.mocked(prisma.reportTemplate.findMany).mockResolvedValue([
      {
        id: 1,
        schedule: 'daily',
        scheduleEmail: 'a@b.com',
        reportType: 'sales_summary',
      } as any,
    ]);
    // 10:00 UTC — not the daily window
    const req = reqAt(new Date(Date.UTC(2026, 4, 15, 10, 0, 0)));

    const res = await POST(req as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.dispatched).toBe(0);
    expect(json.data.skipped).toBe(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('dispatches at 06:00 UTC and records failures per-subscription', async () => {
    vi.mocked(prisma.reportTemplate.findMany).mockResolvedValue([
      {
        id: 1,
        schedule: 'daily',
        scheduleEmail: 'ok@x.com',
        reportType: 'sales_summary',
      } as any,
      {
        id: 2,
        schedule: 'daily',
        scheduleEmail: 'bad@x.com',
        reportType: 'sales_summary',
      } as any,
    ]);
    sendEmailMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('smtp blew up'));
    const req = reqAt(new Date(Date.UTC(2026, 4, 15, 6, 0, 0)));

    const res = await POST(req as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.dispatched).toBe(1);
    expect(json.data.failed).toEqual([{ id: 2, error: 'smtp blew up' }]);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('returns 500 when prisma.findMany throws', async () => {
    vi.mocked(prisma.reportTemplate.findMany).mockRejectedValue(new Error('DB'));
    const req = reqAt(new Date(Date.UTC(2026, 4, 15, 6, 0, 0)));

    const res = await POST(req as any);
    expect(res.status).toBe(500);
    vi.useRealTimers();
  });
});
