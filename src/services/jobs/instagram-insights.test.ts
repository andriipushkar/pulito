import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clientEvent: { create: vi.fn() },
  },
}));

vi.mock('@/config/env', () => ({
  env: {
    INSTAGRAM_ACCESS_TOKEN: '',
    INSTAGRAM_BUSINESS_ACCOUNT_ID: '',
  },
}));

import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { collectInstagramInsights } from './instagram-insights';

const mockPrisma = prisma as unknown as {
  clientEvent: { create: ReturnType<typeof vi.fn> };
};

const mockEnv = env as { INSTAGRAM_ACCESS_TOKEN: string; INSTAGRAM_BUSINESS_ACCOUNT_ID: string };

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.INSTAGRAM_ACCESS_TOKEN = '';
  mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = '';
});

describe('collectInstagramInsights', () => {
  it('should return error when access token is not configured', async () => {
    const result = await collectInstagramInsights();
    expect(result).toEqual({
      collected: false,
      metricsCount: 0,
      error: 'Instagram credentials not configured',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when business account ID is not configured', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'token123';
    const result = await collectInstagramInsights();
    expect(result).toEqual({
      collected: false,
      metricsCount: 0,
      error: 'Instagram credentials not configured',
    });
  });

  it('should return error when API returns non-OK response', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'token123';
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'account123';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });

    const result = await collectInstagramInsights();
    expect(result).toEqual({
      collected: false,
      metricsCount: 0,
      error: 'Instagram API error: 400 Bad Request',
    });
  });

  it('should collect and store metrics successfully', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'token123';
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'account123';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              name: 'impressions',
              period: 'day',
              values: [
                { value: 100, end_time: '2024-01-01T00:00:00Z' },
                { value: 200, end_time: '2024-01-02T00:00:00Z' },
              ],
            },
            {
              name: 'reach',
              period: 'day',
              values: [{ value: 50, end_time: '2024-01-01T00:00:00Z' }],
            },
          ],
        }),
    });
    mockPrisma.clientEvent.create.mockResolvedValue({});

    const result = await collectInstagramInsights();
    expect(result).toEqual({ collected: true, metricsCount: 3 });
    expect(mockPrisma.clientEvent.create).toHaveBeenCalledTimes(3);
    expect(mockPrisma.clientEvent.create).toHaveBeenCalledWith({
      data: {
        eventType: 'instagram_impressions',
        metadata: { value: 100, endTime: '2024-01-01T00:00:00Z' },
        createdAt: new Date('2024-01-01T00:00:00Z'),
      },
    });
  });

  it('should handle empty data array', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'token123';
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'account123';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const result = await collectInstagramInsights();
    expect(result).toEqual({ collected: true, metricsCount: 0 });
    expect(mockPrisma.clientEvent.create).not.toHaveBeenCalled();
  });

  it('should handle metric with empty values array', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'token123';
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'account123';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ name: 'impressions', period: 'day', values: [] }],
        }),
    });

    const result = await collectInstagramInsights();
    expect(result).toEqual({ collected: true, metricsCount: 0 });
  });

  it('should handle fetch network error', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'token123';
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'account123';
    mockFetch.mockRejectedValue(new Error('Network timeout'));

    const result = await collectInstagramInsights();
    expect(result).toEqual({
      collected: false,
      metricsCount: 0,
      error: 'Network timeout',
    });
  });

  it('should handle non-Error throw', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'token123';
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'account123';
    mockFetch.mockRejectedValue('string error');

    const result = await collectInstagramInsights();
    expect(result).toEqual({
      collected: false,
      metricsCount: 0,
      error: 'Unknown error',
    });
  });

  it('should use correct API URL with credentials', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'mytoken';
    mockEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID = 'myaccount';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await collectInstagramInsights();
    expect(mockFetch.mock.calls[0][0]).toContain('myaccount/insights');
    expect(mockFetch.mock.calls[0][0]).toContain('access_token=mytoken');
    expect(mockFetch.mock.calls[0][1].signal).toBeDefined();
  });
});
