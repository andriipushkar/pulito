import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/static-page', () => ({
  getPublishedPages: vi.fn(),
}));

import { GET } from './route';
import { getPublishedPages } from '@/services/static-page';

const mocked = vi.mocked(getPublishedPages);

describe('GET /api/v1/pages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns pages on success', async () => {
    mocked.mockResolvedValue([{ id: 1, title: 'Page' }] as never);
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
