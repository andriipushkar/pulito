// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlag } from './useFeatureFlag';

describe('useFeatureFlag', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with isEnabled false and isLoading true', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFeatureFlag('new-checkout'));

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches flag status from API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true }),
    });

    const { result } = renderHook(() => useFeatureFlag('new-checkout'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/feature-flags/check?key=new-checkout'
    );
  });

  it('sets isEnabled to false when flag is disabled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false }),
    });

    const { result } = renderHook(() => useFeatureFlag('old-feature'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(false);
  });

  it('sets isEnabled to false on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network'));

    const { result } = renderHook(() => useFeatureFlag('feature'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(false);
  });

  it('refetches when key changes', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false }),
      });

    const { result, rerender } = renderHook(
      ({ key }) => useFeatureFlag(key),
      { initialProps: { key: 'flag-a' } }
    );

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    rerender({ key: 'flag-b' });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false);
    });
  });

  it('encodes special characters in key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true }),
    });

    renderHook(() => useFeatureFlag('feature&special=yes'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/feature-flags/check?key=feature%26special%3Dyes'
      );
    });
  });
});
