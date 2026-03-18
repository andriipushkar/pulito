import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUserNotifications = vi.fn();
const mockMarkAllAsRead = vi.fn();

vi.mock('@/services/notification', () => ({
  getUserNotifications: (...args: unknown[]) => mockGetUserNotifications(...args),
  markAllAsRead: (...args: unknown[]) => mockMarkAllAsRead(...args),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => {
    return (request: NextRequest) => {
      return handler(request, { user: { id: 1, email: 'test@test.com', role: 'client' } });
    };
  },
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '' },
}));

import { GET, PUT } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/me/notifications', () => {
  it('should return notifications for authenticated user', async () => {
    mockGetUserNotifications.mockResolvedValue({
      notifications: [{ id: 1, title: 'Test' }],
      total: 1,
      unreadCount: 1,
    });

    const request = new NextRequest('http://localhost/api/v1/me/notifications');
    const res = await GET(request);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.unreadCount).toBe(1);
  });

  it('should pass pagination params', async () => {
    mockGetUserNotifications.mockResolvedValue({ notifications: [], total: 0, unreadCount: 0 });

    const request = new NextRequest('http://localhost/api/v1/me/notifications?page=2&limit=5');
    await GET(request);

    expect(mockGetUserNotifications).toHaveBeenCalledWith(1, { page: 2, limit: 5 });
  });

  it('should return 500 on error', async () => {
    mockGetUserNotifications.mockRejectedValue(new Error('DB error'));

    const request = new NextRequest('http://localhost/api/v1/me/notifications');
    const res = await GET(request);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/me/notifications', () => {
  it('should mark all notifications as read', async () => {
    mockMarkAllAsRead.mockResolvedValue({ count: 3 });

    const request = new NextRequest('http://localhost/api/v1/me/notifications', { method: 'PUT' });
    const res = await PUT(request);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockMarkAllAsRead).toHaveBeenCalledWith(1);
  });

  it('should return 500 on error', async () => {
    mockMarkAllAsRead.mockRejectedValue(new Error('DB error'));

    const request = new NextRequest('http://localhost/api/v1/me/notifications', { method: 'PUT' });
    const res = await PUT(request);

    expect(res.status).toBe(500);
  });
});
