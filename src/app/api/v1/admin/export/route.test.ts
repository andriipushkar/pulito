import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/export', () => ({
  exportOrders: vi.fn(),
  exportClients: vi.fn(),
  exportCatalog: vi.fn(),
  ExportError: class ExportError extends Error { statusCode = 400; },
}));

import { GET } from './route';
import { exportOrders, exportClients, exportCatalog } from '@/services/export';

describe('GET /api/v1/admin/export', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('exports orders on success', async () => {
    vi.mocked(exportOrders).mockResolvedValue({
      buffer: new ArrayBuffer(8) as any,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'orders.xlsx',
    });
    const req = new Request('http://localhost/api/v1/admin/export?type=orders&format=xlsx');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('exports clients on success', async () => {
    vi.mocked(exportClients).mockResolvedValue({
      buffer: new ArrayBuffer(8) as any,
      contentType: 'text/csv',
      filename: 'clients.csv',
    });
    const req = new Request('http://localhost/api/v1/admin/export?type=clients&format=csv');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('exports catalog on success', async () => {
    vi.mocked(exportCatalog).mockResolvedValue({
      buffer: new ArrayBuffer(8) as any,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'catalog.xlsx',
    });
    const req = new Request('http://localhost/api/v1/admin/export?type=catalog');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('defaults to orders export when no type specified', async () => {
    vi.mocked(exportOrders).mockResolvedValue({
      buffer: new ArrayBuffer(8) as any,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'orders.xlsx',
    });
    const req = new Request('http://localhost/api/v1/admin/export');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(exportOrders)).toHaveBeenCalled();
  });

  it('returns 400 for unknown export type', async () => {
    const req = new Request('http://localhost/api/v1/admin/export?type=unknown');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('returns ExportError status code', async () => {
    const { ExportError } = await import('@/services/export');
    vi.mocked(exportOrders).mockRejectedValue(new ExportError('export failed'));
    const req = new Request('http://localhost/api/v1/admin/export?type=orders');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(exportOrders).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost/api/v1/admin/export?type=orders');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
