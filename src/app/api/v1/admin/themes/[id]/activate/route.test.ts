import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/theme', () => ({
  activateTheme: vi.fn(),
  ThemeError: class ThemeError extends Error { statusCode = 400; },
}));

import { PUT } from './route';
import { activateTheme } from '@/services/theme';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/themes/[id]/activate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('activates theme on success', async () => {
    vi.mocked(activateTheme).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', { method: 'PUT' });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'PUT' });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns ThemeError status code', async () => {
    const { ThemeError } = await import('@/services/theme');
    vi.mocked(activateTheme).mockRejectedValue(new ThemeError('not found'));
    const req = new Request('http://localhost', { method: 'PUT' });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(activateTheme).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'PUT' });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
