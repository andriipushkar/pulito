import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/theme', () => ({
  getActiveTheme: vi.fn(),
}));

import { GET } from './route';
import { getActiveTheme } from '@/services/theme';

const mocked = vi.mocked(getActiveTheme);

describe('GET /api/v1/theme', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns theme on success', async () => {
    mocked.mockResolvedValue({ primaryColor: '#000' } as never);
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
