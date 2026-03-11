import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/config/env', () => ({
  env: {
    INSTAGRAM_ACCESS_TOKEN: '',
  },
}));

import { env } from '@/config/env';
import { refreshInstagramToken } from './instagram-token-refresh';

const mockEnv = env as { INSTAGRAM_ACCESS_TOKEN: string };

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.INSTAGRAM_ACCESS_TOKEN = '';
});

describe('refreshInstagramToken', () => {
  it('should return error when access token is not configured', async () => {
    const result = await refreshInstagramToken();
    expect(result).toEqual({
      refreshed: false,
      error: 'Instagram access token not configured',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return error when API returns non-OK response', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'old-token';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const result = await refreshInstagramToken();
    expect(result).toEqual({
      refreshed: false,
      error: 'Instagram API error: 401 Unauthorized',
    });
  });

  it('should refresh token successfully', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'old-token';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-long-token-value-here',
          token_type: 'bearer',
          expires_in: 5184000,
        }),
    });

    const result = await refreshInstagramToken();
    expect(result).toEqual({
      refreshed: true,
      newToken: 'new-long-t...',
      expiresIn: 5184000,
    });
  });

  it('should truncate token to first 10 chars + ...', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'old-token';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'ABCDEFGHIJ_REST_OF_TOKEN',
          token_type: 'bearer',
          expires_in: 3600,
        }),
    });

    const result = await refreshInstagramToken();
    expect(result.newToken).toBe('ABCDEFGHIJ...');
  });

  it('should handle fetch network error', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'old-token';
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const result = await refreshInstagramToken();
    expect(result).toEqual({
      refreshed: false,
      error: 'Connection refused',
    });
  });

  it('should handle non-Error throw', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'old-token';
    mockFetch.mockRejectedValue(42);

    const result = await refreshInstagramToken();
    expect(result).toEqual({
      refreshed: false,
      error: 'Unknown error',
    });
  });

  it('should use correct API URL', async () => {
    mockEnv.INSTAGRAM_ACCESS_TOKEN = 'my-token';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-token-12345',
          token_type: 'bearer',
          expires_in: 5184000,
        }),
    });

    await refreshInstagramToken();
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=my-token'
    );
    expect(mockFetch.mock.calls[0][1].signal).toBeDefined();
  });
});
