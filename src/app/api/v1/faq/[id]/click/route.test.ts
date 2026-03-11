import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/faq', () => ({
  incrementFaqClick: vi.fn(),
}));

import { POST } from './route';
import { incrementFaqClick } from '@/services/faq';

const mocked = vi.mocked(incrementFaqClick);

describe('POST /api/v1/faq/[id]/click', () => {
  beforeEach(() => vi.clearAllMocks());

  it('increments click on success', async () => {
    mocked.mockResolvedValue(undefined as never);
    const req = new NextRequest('http://localhost/api/v1/faq/1/click', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 400 on invalid ID', async () => {
    const req = new NextRequest('http://localhost/api/v1/faq/abc/click', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/faq/1/click', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(500);
  });
});
