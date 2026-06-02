import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCreds = vi.fn();
const mockSave = vi.fn();

vi.mock('@/services/channel-config', () => ({
  getInstagramCreds: (...a: unknown[]) => mockGetCreds(...a),
  saveRefreshedInstagramToken: (...a: unknown[]) => mockSave(...a),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('refreshInstagramToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCreds.mockResolvedValue({ accessToken: 'old-token', businessAccountId: 'biz-1' });
    mockSave.mockResolvedValue(undefined);
  });

  it('refreshes the token and PERSISTS it (the whole point of the fix)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-token', token_type: 'bearer', expires_in: 5184000 }),
    });
    const { refreshInstagramToken } = await import('./instagram-token-refresh');
    const result = await refreshInstagramToken();

    expect(result.refreshed).toBe(true);
    expect(result.expiresIn).toBe(5184000);
    // Calls the refresh endpoint with the CURRENT token...
    expect(mockFetch.mock.calls[0][0]).toContain('graph.instagram.com/refresh_access_token');
    expect(mockFetch.mock.calls[0][0]).toContain('old-token');
    // ...and persists the NEW one (previously this was a no-op).
    expect(mockSave).toHaveBeenCalledWith('new-token', 5184000);
    // Never leak the token back to the caller.
    expect(JSON.stringify(result)).not.toContain('new-token');
  });

  it('does nothing when no token is configured', async () => {
    mockGetCreds.mockResolvedValue({ accessToken: '', businessAccountId: '' });
    const { refreshInstagramToken } = await import('./instagram-token-refresh');
    const result = await refreshInstagramToken();
    expect(result.refreshed).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does NOT persist when the API returns no token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ token_type: 'bearer' }) });
    const { refreshInstagramToken } = await import('./instagram-token-refresh');
    const result = await refreshInstagramToken();
    expect(result.refreshed).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does NOT persist on a non-OK API response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad token' });
    const { refreshInstagramToken } = await import('./instagram-token-refresh');
    const result = await refreshInstagramToken();
    expect(result.refreshed).toBe(false);
    expect(result.error).toContain('400');
    expect(mockSave).not.toHaveBeenCalled();
  });
});
