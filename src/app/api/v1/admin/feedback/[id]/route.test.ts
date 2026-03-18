import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/feedback', () => ({ updateFeedbackStatusSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/feedback', () => ({
  updateFeedbackStatus: vi.fn(),
  FeedbackError: class FeedbackError extends Error { statusCode = 400; },
}));

import { PUT } from './route';
import { updateFeedbackStatus } from '@/services/feedback';
import { updateFeedbackStatusSchema } from '@/validators/feedback';

const mockCtx = { user: { id: 1 }, params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/feedback/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates feedback status on success', async () => {
    vi.mocked(updateFeedbackStatusSchema.safeParse).mockReturnValue({ success: true, data: { status: 'approved' } } as any);
    vi.mocked(updateFeedbackStatus).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'approved' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'approved' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { user: { id: 1 }, params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 on validation error', async () => {
    vi.mocked(updateFeedbackStatusSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad status' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns FeedbackError status code', async () => {
    const { FeedbackError } = await import('@/services/feedback');
    vi.mocked(updateFeedbackStatusSchema.safeParse).mockReturnValue({ success: true, data: { status: 'approved' } } as any);
    vi.mocked(updateFeedbackStatus).mockRejectedValue(new (FeedbackError as any)('not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'approved' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updateFeedbackStatusSchema.safeParse).mockReturnValue({ success: true, data: { status: 'approved' } } as any);
    vi.mocked(updateFeedbackStatus).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'approved' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
