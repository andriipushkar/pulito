import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetcher } from './swr';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetcher', () => {
  it('fetches URL, parses JSON, and returns data field', async () => {
    const mockData = { id: 1, name: 'Test' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ data: mockData }),
    } as Response);

    const result = await fetcher('/api/v1/products');
    expect(fetch).toHaveBeenCalledWith('/api/v1/products');
    expect(result).toEqual(mockData);
  });

  it('returns undefined when response has no data field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const result = await fetcher('/api/v1/test');
    expect(result).toBeUndefined();
  });

  it('propagates fetch errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    await expect(fetcher('/api/v1/fail')).rejects.toThrow('Network error');
  });

  it('propagates JSON parse errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.reject(new Error('Invalid JSON')),
    } as Response);
    await expect(fetcher('/api/v1/bad')).rejects.toThrow('Invalid JSON');
  });
});
