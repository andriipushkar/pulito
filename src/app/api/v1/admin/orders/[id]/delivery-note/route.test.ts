import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/pdf', () => ({
  generateDeliveryNotePdf: vi.fn(),
  PdfError: class PdfError extends Error { statusCode = 400; },
}));

import { POST } from './route';
import { generateDeliveryNotePdf } from '@/services/pdf';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('POST /api/v1/admin/orders/[id]/delivery-note', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates delivery note on success', async () => {
    vi.mocked(generateDeliveryNotePdf).mockResolvedValue('/pdfs/delivery-note.pdf');
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    vi.mocked(generateDeliveryNotePdf).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns PdfError status on PdfError', async () => {
    const { PdfError } = await import('@/services/pdf');
    vi.mocked(generateDeliveryNotePdf).mockRejectedValue(new PdfError('not found'));
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
