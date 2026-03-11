import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/ukrposhta', () => ({ createShipmentSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/ukrposhta', () => ({
  createShipment: vi.fn(),
  UkrposhtaError: class UkrposhtaError extends Error { statusCode = 400; },
}));

import { POST } from './route';
import { createShipment } from '@/services/ukrposhta';
import { createShipmentSchema } from '@/validators/ukrposhta';

describe('POST /api/v1/admin/ukrposhta/shipment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates shipment on success', async () => {
    vi.mocked(createShipmentSchema.safeParse).mockReturnValue({ success: true, data: { recipientName: 'Test' } } as any);
    vi.mocked(createShipment).mockResolvedValue({ barcode: '123' } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ recipientName: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    vi.mocked(createShipmentSchema.safeParse).mockReturnValue({ success: true, data: { recipientName: 'Test' } } as any);
    vi.mocked(createShipment).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ recipientName: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on validation failure', async () => {
    vi.mocked(createShipmentSchema.safeParse).mockReturnValue({ success: false, error: { flatten: () => ({ fieldErrors: { recipientName: ['required'] } }) } } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns UkrposhtaError status on UkrposhtaError', async () => {
    const { UkrposhtaError } = await import('@/services/ukrposhta');
    vi.mocked(createShipmentSchema.safeParse).mockReturnValue({ success: true, data: { recipientName: 'Test' } } as any);
    vi.mocked(createShipment).mockRejectedValue(new UkrposhtaError('api error'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ recipientName: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
