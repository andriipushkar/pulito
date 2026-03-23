// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExperiment } from './useExperiment';

describe('useExperiment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with null variant and isLoading true', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useExperiment('test-exp'));

    expect(result.current.variant).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches variant from API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { variant: 'B' } }),
    });

    const { result } = renderHook(() => useExperiment('test-exp'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.variant).toBe('B');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/experiments/test-exp',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('sets variant to null on API error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useExperiment('test-exp'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.variant).toBeNull();
  });

  it('sets variant to null on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => null,
    });

    const { result } = renderHook(() => useExperiment('test-exp'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.variant).toBeNull();
  });

  it('refetches when experimentKey changes', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { variant: 'A' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { variant: 'C' } }),
      });

    const { result, rerender } = renderHook(
      ({ key }) => useExperiment(key),
      { initialProps: { key: 'exp1' } }
    );

    await waitFor(() => {
      expect(result.current.variant).toBe('A');
    });

    rerender({ key: 'exp2' });

    await waitFor(() => {
      expect(result.current.variant).toBe('C');
    });
  });
});
