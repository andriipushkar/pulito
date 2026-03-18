import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/import', () => ({ getImportLogById: vi.fn() }));

import { GET } from './route';
import { getImportLogById } from '@/services/import';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('GET /api/v1/admin/import/logs/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns import log on success', async () => {
    vi.mocked(getImportLogById).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when log not found', async () => {
    vi.mocked(getImportLogById).mockResolvedValue(null as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getImportLogById).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
