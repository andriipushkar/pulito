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
  withRole: (..._roles: string[]) => (handler: any) => handler,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceMessage: { update: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { PATCH } from './route';
import { prisma } from '@/lib/prisma';

const mockUpdate = vi.mocked(prisma.marketplaceMessage.update);
const mockUserFind = vi.mocked(prisma.user.findUnique);

const makeReq = (body: unknown) =>
  new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PATCH /api/v1/admin/marketplaces/messages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns message to a manager', async () => {
    mockUserFind.mockResolvedValue({ id: 7, role: 'manager' } as any);
    mockUpdate.mockResolvedValue({
      id: 1,
      isRead: false,
      assignee: { id: 7, fullName: 'Анна' },
    } as any);

    const res = await PATCH(makeReq({ assigneeId: 7 }) as any, {
      params: Promise.resolve({ id: '1' }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.assignee).toEqual({ id: 7, fullName: 'Анна' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedTo: 7 }) }),
    );
  });

  it('clears assignment when assigneeId is null', async () => {
    mockUpdate.mockResolvedValue({ id: 1, isRead: false, assignee: null } as any);

    const res = await PATCH(makeReq({ assigneeId: null }) as any, {
      params: Promise.resolve({ id: '1' }),
    });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedTo: null }) }),
    );
  });

  it('marks isRead toggling', async () => {
    mockUpdate.mockResolvedValue({ id: 1, isRead: true, assignee: null } as any);

    const res = await PATCH(makeReq({ isRead: true }) as any, {
      params: Promise.resolve({ id: '1' }),
    });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isRead: true }) }),
    );
  });

  it('rejects assigning to non-staff user', async () => {
    mockUserFind.mockResolvedValue({ id: 12, role: 'client' } as any);

    const res = await PATCH(makeReq({ assigneeId: 12 }) as any, {
      params: Promise.resolve({ id: '1' }),
    });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when assignee user does not exist', async () => {
    mockUserFind.mockResolvedValue(null as any);

    const res = await PATCH(makeReq({ assigneeId: 999 }) as any, {
      params: Promise.resolve({ id: '999' }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 when no fields supplied', async () => {
    const res = await PATCH(makeReq({}) as any, {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid ID', async () => {
    const res = await PATCH(makeReq({ isRead: true }) as any, {
      params: Promise.resolve({ id: 'abc' }),
    });
    expect(res.status).toBe(400);
  });
});
