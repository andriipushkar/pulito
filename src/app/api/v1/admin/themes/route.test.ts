import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/theme', () => ({
  getAllThemes: vi.fn(),
  uploadTheme: vi.fn(),
  ThemeError: class ThemeError extends Error { statusCode = 400; },
}));

import { GET, POST } from './route';
import { getAllThemes, uploadTheme } from '@/services/theme';

describe('GET /api/v1/admin/themes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns themes on success', async () => {
    vi.mocked(getAllThemes).mockResolvedValue([]);
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns ThemeError status code on GET', async () => {
    const { ThemeError } = await import('@/services/theme');
    vi.mocked(getAllThemes).mockRejectedValue(new ThemeError('theme error'));
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on GET error', async () => {
    vi.mocked(getAllThemes).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/themes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when no file provided', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-zip file', async () => {
    const formData = new FormData();
    formData.append('file', new File(['data'], 'theme.tar.gz', { type: 'application/gzip' }));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when file too large', async () => {
    const formData = new FormData();
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'theme.zip', { type: 'application/zip' });
    Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
    formData.append('file', bigFile);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('uploads theme successfully', async () => {
    vi.mocked(uploadTheme).mockResolvedValue({ id: 1, name: 'test' } as any);
    const formData = new FormData();
    formData.append('file', new File(['data'], 'theme.zip', { type: 'application/zip' }));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns ThemeError status code on POST', async () => {
    const { ThemeError } = await import('@/services/theme');
    vi.mocked(uploadTheme).mockRejectedValue(new ThemeError('bad theme'));
    const formData = new FormData();
    formData.append('file', new File(['data'], 'theme.zip', { type: 'application/zip' }));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on POST error', async () => {
    vi.mocked(uploadTheme).mockRejectedValue(new Error('fail'));
    const formData = new FormData();
    formData.append('file', new File(['data'], 'theme.zip', { type: 'application/zip' }));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
