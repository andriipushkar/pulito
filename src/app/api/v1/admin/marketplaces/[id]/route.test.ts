import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/marketplaces', () => ({
  updateMarketplaceListing: vi.fn(),
  deleteMarketplaceListing: vi.fn(),
  MARKETPLACE_CHANNELS: ['rozetka', 'prom'],
}));
vi.mock('@/services/marketplace-sync', () => ({
  getConnectionStatus: vi.fn(),
  syncProductsToMarketplace: vi.fn(),
  syncStockToMarketplace: vi.fn(),
  importOrdersFromMarketplace: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PUT, PATCH, POST, DELETE } from './route';
import { getConnectionStatus, syncProductsToMarketplace } from '@/services/marketplace-sync';
import { updateMarketplaceListing, deleteMarketplaceListing } from '@/services/marketplaces';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/v1/admin/marketplaces/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns connection status on success', async () => {
    (getConnectionStatus as any).mockResolvedValue({ platform: 'rozetka', connected: true });

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('rozetka'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid platform', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('unknown'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (getConnectionStatus as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('rozetka'));

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/marketplaces/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates marketplace listing on success', async () => {
    (updateMarketplaceListing as any).mockResolvedValue({ status: 'published' });

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'rozetka', externalId: 'ext1', title: 'Product' }),
    });
    const res = await PUT(req, makeParams('rozetka'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.updated).toBe(true);
  });

  it('returns 400 when channel or externalId missing', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PUT(req, makeParams('rozetka'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (updateMarketplaceListing as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'rozetka', externalId: 'ext1' }),
    });
    const res = await PUT(req, makeParams('rozetka'));

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/marketplaces/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for invalid platform', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeParams('unknown'));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/admin/marketplaces/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('syncs products on success', async () => {
    (syncProductsToMarketplace as any).mockResolvedValue({ synced: 10 });

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'products' }),
    });
    const res = await POST(req, makeParams('rozetka'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid platform', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'products' }),
    });
    const res = await POST(req, makeParams('unknown'));

    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown action', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid' }),
    });
    const res = await POST(req, makeParams('rozetka'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (syncProductsToMarketplace as any).mockRejectedValue(new Error('Sync failed'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'products' }),
    });
    const res = await POST(req, makeParams('rozetka'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/marketplaces/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes marketplace listing on success', async () => {
    (deleteMarketplaceListing as any).mockResolvedValue({ status: 'published' });

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/rozetka?channel=rozetka&externalId=ext1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rozetka'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it('returns 400 when channel or externalId missing', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/rozetka', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rozetka'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (deleteMarketplaceListing as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/rozetka?channel=rozetka&externalId=ext1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rozetka'));

    expect(res.status).toBe(500);
  });
});
