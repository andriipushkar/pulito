import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleOAuthError, getGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserProfile } from './google-oauth';

vi.mock('@/config/env', () => ({
  env: {
    APP_URL: 'https://test.com',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    APP_SECRET: 'test-app-secret-for-hmac',
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GoogleOAuthError', () => {
  it('should have correct name and default statusCode', () => {
    const err = new GoogleOAuthError('test');
    expect(err.name).toBe('GoogleOAuthError');
    expect(err.statusCode).toBe(400);
  });

  it('should accept custom statusCode', () => {
    const err = new GoogleOAuthError('test', 401);
    expect(err.statusCode).toBe(401);
  });
});

describe('getGoogleAuthUrl', () => {
  it('should return a valid Google auth URL', () => {
    const url = getGoogleAuthUrl('test-state-value');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('scope=openid+email+profile');
    expect(url).toContain('state=test-state-value');
  });
});

describe('exchangeCodeForTokens', () => {
  it('should return tokens on success', async () => {
    const mockTokens = {
      access_token: 'access-123',
      id_token: 'id-456',
      token_type: 'Bearer',
      expires_in: 3600,
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    });

    const result = await exchangeCodeForTokens('auth-code');
    expect(result.access_token).toBe('access-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should throw on failed exchange', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'invalid_grant', error_description: 'Code expired' }),
    });

    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow(GoogleOAuthError);
  });
});

describe('getGoogleUserProfile', () => {
  it('should return user profile on success', async () => {
    const mockProfile = { id: 'g-1', email: 'user@gmail.com', name: 'Test User', picture: 'https://photo.url' };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    });

    const result = await getGoogleUserProfile('access-123');
    expect(result.email).toBe('user@gmail.com');
    expect(result.name).toBe('Test User');
  });

  it('should throw on failed profile fetch', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Invalid token' } }),
    });

    await expect(getGoogleUserProfile('bad-token')).rejects.toThrow(GoogleOAuthError);
  });

  it('should throw when response is ok but no id in profile', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'no-id@test.com', name: 'No Id' }),
    });

    await expect(getGoogleUserProfile('token')).rejects.toThrow(GoogleOAuthError);
  });

  it('should throw with Unknown error when no error message in profile response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(getGoogleUserProfile('bad-token')).rejects.toThrow('Unknown error');
  });
});

describe('getGoogleAuthUrl - missing client ID', () => {
  it('should throw when client ID is not configured', async () => {
    const envMod = await import('@/config/env');
    const originalClientId = envMod.env.GOOGLE_CLIENT_ID;
    (envMod.env as unknown as Record<string, string>).GOOGLE_CLIENT_ID = '';

    try {
      expect(() => getGoogleAuthUrl('test-state')).toThrow(GoogleOAuthError);
    } finally {
      (envMod.env as unknown as Record<string, string>).GOOGLE_CLIENT_ID = originalClientId;
    }
  });
});

describe('exchangeCodeForTokens - missing credentials', () => {
  it('should throw when client ID or secret is not configured', async () => {
    const envMod = await import('@/config/env');
    const originalClientId = envMod.env.GOOGLE_CLIENT_ID;
    (envMod.env as unknown as Record<string, string>).GOOGLE_CLIENT_ID = '';

    try {
      await expect(exchangeCodeForTokens('code')).rejects.toThrow('Google OAuth not configured');
    } finally {
      (envMod.env as unknown as Record<string, string>).GOOGLE_CLIENT_ID = originalClientId;
    }
  });

  it('should throw with error_description from exchange response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'invalid_grant', error_description: 'Code expired' }),
    });

    try {
      await exchangeCodeForTokens('expired-code');
    } catch (e) {
      expect((e as GoogleOAuthError).message).toContain('Code expired');
      expect((e as GoogleOAuthError).statusCode).toBe(401);
    }
  });

  it('should handle ok response but missing access_token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id_token: 'id' }), // no access_token
    });

    await expect(exchangeCodeForTokens('code')).rejects.toThrow(GoogleOAuthError);
  });
});
