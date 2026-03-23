import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/utils/file-validation', () => ({
  validateFileType: vi.fn().mockResolvedValue({ valid: true }),
}));
vi.mock('@/utils/image-sanitizer', () => ({
  sanitizeImage: vi.fn().mockResolvedValue(Buffer.from('sanitized')),
}));
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { POST } from './route';

describe('POST /api/v1/admin/upload', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uploads a file successfully', async () => {
    const file = new File([new Uint8Array(100)], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'general');

    const req = new Request('http://localhost', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.path).toContain('/uploads/general/');
  });

  it('returns 400 when no file provided', async () => {
    const formData = new FormData();

    const req = new Request('http://localhost', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid folder', async () => {
    const file = new File([new Uint8Array(100)], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'malicious');

    const req = new Request('http://localhost', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported file type', async () => {
    const file = new File([new Uint8Array(100)], 'test.exe', { type: 'application/x-executable' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new Request('http://localhost', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 for file too large', async () => {
    const largeBuffer = new Uint8Array(6 * 1024 * 1024);
    const file = new File([largeBuffer], 'big.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new Request('http://localhost', {
      method: 'POST',
      body: formData,
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});
