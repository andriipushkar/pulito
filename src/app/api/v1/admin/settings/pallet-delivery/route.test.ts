import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
const mockSafeParse = vi.fn().mockReturnValue({ success: true, data: {} });
vi.mock('@/validators/pallet-delivery', () => ({ palletConfigSchema: { partial: () => ({ safeParse: (...args: unknown[]) => mockSafeParse(...args) }) } }));
vi.mock('@/services/pallet-delivery', () => ({
  getPalletConfig: vi.fn(),
  updatePalletConfig: vi.fn(),
  PalletDeliveryError: class PalletDeliveryError extends Error { statusCode = 400; },
}));

import { GET, PUT } from './route';
import { getPalletConfig, updatePalletConfig } from '@/services/pallet-delivery';

describe('GET /api/v1/admin/settings/pallet-delivery', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns pallet config on success', async () => {
    vi.mocked(getPalletConfig).mockResolvedValue({} as any);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getPalletConfig).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/settings/pallet-delivery', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates pallet config on success', async () => {
    vi.mocked(updatePalletConfig).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(updatePalletConfig).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on validation failure', async () => {
    mockSafeParse.mockReturnValueOnce({ success: false, error: { issues: [{ message: 'bad' }] } });
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(400);
  });

  it('uses fallback message when issues array is empty', async () => {
    mockSafeParse.mockReturnValueOnce({ success: false, error: { issues: [] } });
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Невірні дані');
  });

  it('returns PalletDeliveryError status on PalletDeliveryError', async () => {
    const { PalletDeliveryError } = await import('@/services/pallet-delivery');
    vi.mocked(updatePalletConfig).mockRejectedValue(new (PalletDeliveryError as any)('bad config'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(400);
  });
});
