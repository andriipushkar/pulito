import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed')),
  }),
}));

vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('@/utils/file-validation', () => ({
  validateFileType: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { uploadFile } from '@/lib/storage';
import { validateFileType } from '@/utils/file-validation';

const mockUpload = uploadFile as ReturnType<typeof vi.fn>;
const mockValidate = validateFileType as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('POST /api/v1/reviews/upload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when no files provided', async () => {
    const formData = new FormData();
    const req = new NextRequest('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported file type', async () => {
    const file = new File(['data'], 'test.gif', { type: 'image/gif' });
    const formData = new FormData();
    formData.append('images', file);
    const req = new NextRequest('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('uploads images on success', async () => {
    mockValidate.mockResolvedValue({ valid: true });
    mockUpload.mockResolvedValue('https://cdn.example.com/reviews/1/img.webp');
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    const req = new NextRequest('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.urls).toHaveLength(1);
  });

  it('returns 400 when file content validation fails', async () => {
    mockValidate.mockResolvedValue({ valid: false });
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    const req = new NextRequest('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });
});
