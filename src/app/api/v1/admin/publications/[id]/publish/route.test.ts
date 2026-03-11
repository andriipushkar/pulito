import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/publication', () => ({
  publishNow: vi.fn(),
  PublicationError: class PublicationError extends Error { statusCode = 400; },
}));

import { POST } from './route';
import { publishNow } from '@/services/publication';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('POST /api/v1/admin/publications/[id]/publish', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('publishes on success', async () => {
    vi.mocked(publishNow).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns PublicationError status code', async () => {
    const { PublicationError } = await import('@/services/publication');
    vi.mocked(publishNow).mockRejectedValue(new PublicationError('not found'));
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(publishNow).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
