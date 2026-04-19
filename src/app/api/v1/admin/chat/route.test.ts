import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
      handler,
}));
vi.mock('@/services/chat', () => ({
  getAdminRooms: vi.fn(),
}));
vi.mock('@/validators/chat', () => ({
  adminChatFilterSchema: {
    safeParse: vi.fn(),
  },
}));
vi.mock('@/utils/api-response', () => ({
  paginatedResponse: (data: any, total: number, page: number, limit: number) =>
    Response.json({ data, total, page, limit }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET } from './route';
import { getAdminRooms } from '@/services/chat';
import { adminChatFilterSchema } from '@/validators/chat';

describe('GET /api/v1/admin/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated rooms on success', async () => {
    (adminChatFilterSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { page: 1, limit: 20, status: undefined, search: undefined },
    });
    (getAdminRooms as any).mockResolvedValue({ rooms: [{ id: 1 }], total: 1 });

    const req = new NextRequest('http://localhost/api/v1/admin/chat');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(1);
  });

  it('returns 400 on validation error', async () => {
    (adminChatFilterSchema.safeParse as any).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    });

    const req = new NextRequest('http://localhost/api/v1/admin/chat');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (adminChatFilterSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { page: 1, limit: 20 },
    });
    (getAdminRooms as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/chat');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
