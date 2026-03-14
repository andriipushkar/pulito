import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, setAccessToken, getAccessToken } from './api-client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken(null);
});

describe('api-client', () => {
  it('setAccessToken / getAccessToken round-trips', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('test-token');
    expect(getAccessToken()).toBe('test-token');
  });

  it('apiClient.get sends GET request', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true, data: { id: 1 } }),
    });

    const result = await apiClient.get('/api/v1/test');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual({ success: true, data: { id: 1 } });
  });

  it('apiClient.post sends POST request with body', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiClient.post('/api/v1/test', { foo: 'bar' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
  });

  it('includes Authorization header when token is set', async () => {
    setAccessToken('my-token');
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiClient.get('/api/v1/test');
    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Authorization']).toBe('Bearer my-token');
  });

  it('retries on 401 by refreshing token', async () => {
    setAccessToken('expired-token');
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: () => Promise.resolve({ success: false }),
    });
    // Refresh call succeeds
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { accessToken: 'new-token' } }),
    });
    // Retry call succeeds
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true, data: 'ok' }),
    });

    const result = await apiClient.get('/api/v1/protected');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ success: true, data: 'ok' });
  });

  it('apiClient.put sends PUT request', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiClient.put('/api/v1/test', { name: 'updated' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('apiClient.delete sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiClient.delete('/api/v1/test');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('attempts refresh on 401 even without accessToken', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: () => Promise.resolve({ success: false, error: 'unauthorized' }),
    });
    // Refresh call fails
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: () => Promise.resolve({ success: false }),
    });

    const result = await apiClient.get('/api/v1/test');
    expect(mockFetch).toHaveBeenCalledTimes(2); // original + refresh attempt
    expect(result).toEqual({ success: false, error: 'unauthorized' });
  });

  it('does not retry when refresh fails (res not ok)', async () => {
    setAccessToken('expired-token');
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: () => Promise.resolve({ success: false }),
    });
    // Refresh call fails (not ok)
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: () => Promise.resolve({ success: false }),
    });

    const result = await apiClient.get('/api/v1/protected');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: false });
  });

  it('does not retry when refresh returns no token', async () => {
    setAccessToken('expired-token');
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: () => Promise.resolve({ success: false }),
    });
    // Refresh succeeds but no accessToken in response
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });

    const result = await apiClient.get('/api/v1/protected');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: false });
  });

  it('handles refresh fetch error gracefully', async () => {
    setAccessToken('expired-token');
    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: () => Promise.resolve({ success: false }),
    });
    // Refresh call throws
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await apiClient.get('/api/v1/protected');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: false });
  });

  it('apiClient.post sends without body when body is undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiClient.post('/api/v1/test');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({ method: 'POST', body: undefined })
    );
  });

  it('apiClient.put sends without body when body is undefined', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiClient.put('/api/v1/test');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({ method: 'PUT', body: undefined })
    );
  });
});
