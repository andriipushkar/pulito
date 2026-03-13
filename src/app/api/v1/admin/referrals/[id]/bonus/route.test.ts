import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/referral', () => ({ grantBonusSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/referral', () => ({
  grantReferralBonus: vi.fn(),
  ReferralError: class ReferralError extends Error { statusCode = 400; },
}));

import { POST } from './route';
import { grantReferralBonus } from '@/services/referral';
import { grantBonusSchema } from '@/validators/referral';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('POST /api/v1/admin/referrals/[id]/bonus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('grants bonus on success', async () => {
    vi.mocked(grantBonusSchema.safeParse).mockReturnValue({ success: true, data: { amount: 100 } } as any);
    vi.mocked(grantReferralBonus).mockResolvedValue({ success: true } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 on validation error', async () => {
    vi.mocked(grantBonusSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad amount' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ amount: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns ReferralError status code', async () => {
    const { ReferralError } = await import('@/services/referral');
    vi.mocked(grantBonusSchema.safeParse).mockReturnValue({ success: true, data: { amount: 100 } } as any);
    vi.mocked(grantReferralBonus).mockRejectedValue(new (ReferralError as any)('not found'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(grantBonusSchema.safeParse).mockReturnValue({ success: true, data: { amount: 100 } } as any);
    vi.mocked(grantReferralBonus).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
