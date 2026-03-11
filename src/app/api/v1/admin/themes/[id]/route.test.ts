import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/theme', () => ({
  updateThemeSettings: vi.fn(),
  ThemeError: class ThemeError extends Error { statusCode = 400; },
}));

import { PUT } from './route';
import { updateThemeSettings } from '@/services/theme';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('PUT /api/v1/admin/themes/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates theme settings on success', async () => {
    vi.mocked(updateThemeSettings).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ customSettings: { primaryColor: '#000' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updateThemeSettings).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ customSettings: { primaryColor: '#000' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ customSettings: { primaryColor: '#000' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when customSettings is missing', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ something: 'else' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns ThemeError status on ThemeError', async () => {
    const { ThemeError } = await import('@/services/theme');
    vi.mocked(updateThemeSettings).mockRejectedValue(new ThemeError('not found'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ customSettings: { primaryColor: '#000' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
