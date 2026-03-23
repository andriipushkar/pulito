import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/services/totp', () => ({
  generateSecret: vi.fn(),
  generateOtpauthUrl: vi.fn(),
}));

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn() } }));

vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn() },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { generateSecret, generateOtpauthUrl } from '@/services/totp';
import QRCode from 'qrcode';

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const mockGenerateSecret = generateSecret as ReturnType<typeof vi.fn>;
const mockGenerateOtpauthUrl = generateOtpauthUrl as ReturnType<typeof vi.fn>;
const mockToDataURL = QRCode.toDataURL as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('POST /api/v1/auth/2fa/setup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 if user not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 if 2FA already enabled', async () => {
    mockFindUnique.mockResolvedValue({ email: 'test@test.com', twoFactorEnabled: true });
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns secret and QR code on success', async () => {
    mockFindUnique.mockResolvedValue({ email: 'test@test.com', twoFactorEnabled: false });
    mockGenerateSecret.mockReturnValue('SECRET123');
    mockGenerateOtpauthUrl.mockReturnValue('otpauth://totp/test');
    mockToDataURL.mockResolvedValue('data:image/png;base64,abc');
    mockUpdate.mockResolvedValue({});

    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.secret).toBe('SECRET123');
    expect(json.data.qrDataUrl).toBe('data:image/png;base64,abc');
  });

  it('returns 500 on error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db error'));
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
