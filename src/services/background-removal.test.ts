import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMock = vi.hoisted(() => ({ REMOVEBG_API_KEY: '' }));
vi.mock('@/config/env', () => ({ env: envMock }));

import { isBackgroundRemovalEnabled, removeBackground } from './background-removal';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  vi.clearAllMocks();
  envMock.REMOVEBG_API_KEY = '';
});

describe('isBackgroundRemovalEnabled', () => {
  it('false when no key', () => {
    expect(isBackgroundRemovalEnabled()).toBe(false);
  });

  it('true when key set', () => {
    envMock.REMOVEBG_API_KEY = 'k';
    expect(isBackgroundRemovalEnabled()).toBe(true);
  });
});

describe('removeBackground', () => {
  it('returns null when service disabled', async () => {
    const r = await removeBackground(Buffer.from('x'), 'image/jpeg');
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns PNG buffer on 200 response', async () => {
    envMock.REMOVEBG_API_KEY = 'k';
    const cutout = Buffer.from('cutout-bytes');
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => cutout.buffer,
    } as Response);
    const r = await removeBackground(Buffer.from('orig'), 'image/jpeg');
    expect(r).toBeInstanceOf(Buffer);
  });

  it('returns null on 4xx response', async () => {
    envMock.REMOVEBG_API_KEY = 'k';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => 'Quota exceeded',
    } as Response);
    const r = await removeBackground(Buffer.from('x'), 'image/jpeg');
    expect(r).toBeNull();
  });

  it('returns null on network error', async () => {
    envMock.REMOVEBG_API_KEY = 'k';
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const r = await removeBackground(Buffer.from('x'), 'image/jpeg');
    expect(r).toBeNull();
  });

  it('passes API key in X-Api-Key header', async () => {
    envMock.REMOVEBG_API_KEY = 'my-secret';
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('x').buffer,
    } as Response);
    await removeBackground(Buffer.from('img'), 'image/jpeg');
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('my-secret');
  });
});
