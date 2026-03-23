import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/marketplaces', () => ({ getMarketplaceMessages: vi.fn() }));

import { GET } from './route';
import { getMarketplaceMessages } from '@/services/marketplaces';
import { NextRequest } from 'next/server';

const mockGetMessages = vi.mocked(getMarketplaceMessages);

describe('GET /api/v1/admin/marketplaces/messages', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns messages for a specific channel', async () => {
    const msgs = [{ id: 1, text: 'hello', createdAt: '2024-01-01' }];
    mockGetMessages.mockResolvedValue(msgs as any);

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/messages?channel=olx');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(msgs);
    expect(mockGetMessages).toHaveBeenCalledWith('olx');
  });

  it('returns merged messages from all channels when no channel specified', async () => {
    mockGetMessages.mockResolvedValue([{ id: 1, text: 'a', createdAt: '2024-01-02' }] as any);

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/messages');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetMessages).toHaveBeenCalledTimes(3);
  });

  it('returns 500 on error', async () => {
    mockGetMessages.mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/marketplaces/messages?channel=olx');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
