import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/faq', () => ({
  getAllFaq: vi.fn(),
  createFaqItem: vi.fn(),
  FaqError: class FaqError extends Error { statusCode = 400; },
}));

import { GET, POST } from './route';
import { getAllFaq, createFaqItem } from '@/services/faq';

describe('GET /api/v1/admin/faq', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns FAQ on success', async () => {
    vi.mocked(getAllFaq).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getAllFaq).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/faq', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates FAQ item on success', async () => {
    vi.mocked(createFaqItem).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ category: 'General', question: 'How does it work?', answer: 'Like this works' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ category: '', question: '', answer: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });

  it('returns FaqError status code', async () => {
    const { FaqError } = await import('@/services/faq');
    vi.mocked(createFaqItem).mockRejectedValue(new (FaqError as any)('duplicate'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ category: 'General', question: 'How does it work?', answer: 'Like this works' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(createFaqItem).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ category: 'General', question: 'How does it work?', answer: 'Like this works' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
