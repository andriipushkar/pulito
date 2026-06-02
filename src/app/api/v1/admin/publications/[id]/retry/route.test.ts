import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: any) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 1, email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/services/publication', () => ({
  retryChannel: vi.fn(),
  PublicationError: class PublicationError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { POST } from './route';
import { retryChannel, PublicationError } from '@/services/publication';

const mockRetry = vi.mocked(retryChannel);

describe('POST /api/v1/admin/publications/[id]/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries channel publication', async () => {
    const pub = { id: 1, channel: 'olx', status: 'published' };
    mockRetry.mockResolvedValue(pub as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'olx' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(pub);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'olx' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when channel not specified', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(400);
  });

  it('returns PublicationError status code', async () => {
    mockRetry.mockRejectedValue(new PublicationError('Not found', 404));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'olx' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(404);
  });

  it('returns 500 on generic error', async () => {
    mockRetry.mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'olx' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
