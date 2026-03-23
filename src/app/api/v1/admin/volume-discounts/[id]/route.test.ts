import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/volume-pricing', () => ({
  updateVolumeDiscount: vi.fn(),
  deleteVolumeDiscount: vi.fn(),
  VolumePricingError: class VolumePricingError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));
vi.mock('@/validators/volume-discount', () => ({
  updateVolumeDiscountSchema: {
    safeParse: vi.fn((data: any) => {
      if (Object.keys(data).length > 0) return { success: true, data };
      return { success: false, error: { issues: [{ message: 'Invalid data' }] } };
    }),
  },
}));

import { PATCH, DELETE } from './route';
import { updateVolumeDiscount, deleteVolumeDiscount, VolumePricingError } from '@/services/volume-pricing';

describe('PATCH /api/v1/admin/volume-discounts/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates a volume discount', async () => {
    const item = { id: 1, minQuantity: 20, discountPercent: 10 };
    vi.mocked(updateVolumeDiscount).mockResolvedValue(item as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minQuantity: 20 }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(item);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minQuantity: 20 }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns VolumePricingError status code', async () => {
    vi.mocked(updateVolumeDiscount).mockRejectedValue(new VolumePricingError('Not found', 404));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minQuantity: 20 }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(updateVolumeDiscount).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minQuantity: 20 }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/volume-discounts/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes a volume discount', async () => {
    vi.mocked(deleteVolumeDiscount).mockResolvedValue(undefined as any);

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns VolumePricingError status code', async () => {
    vi.mocked(deleteVolumeDiscount).mockRejectedValue(new VolumePricingError('Not found', 404));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    vi.mocked(deleteVolumeDiscount).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
