import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/faq', () => ({
  getPublishedFaq: vi.fn(),
}));

import { GET } from './route';
import { getPublishedFaq } from '@/services/faq';

const mocked = vi.mocked(getPublishedFaq);

describe('GET /api/v1/faq', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns FAQ on success', async () => {
    mocked.mockResolvedValue([{ id: 1, question: 'Q?' }] as never);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
