// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockMutate = vi.fn();
let mockUser: { id: number } | null = { id: 1 };
let mockSwrData: unknown[] | undefined = undefined;
let mockSwrError: Error | undefined = undefined;
let mockSwrLoading = false;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('swr', () => ({
  default: () => ({
    data: mockSwrData,
    error: mockSwrError,
    isLoading: mockSwrLoading,
    mutate: mockMutate,
  }),
}));

vi.mock('@/lib/swr', () => ({
  fetcher: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: () => 'token',
  setAccessToken: vi.fn(),
}));

import {
  useSubscriptions,
  useCreateSubscription,
  usePauseSubscription,
  useResumeSubscription,
  useCancelSubscription,
} from './useSubscription';
import { apiClient } from '@/lib/api-client';

describe('useSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1 };
    mockSwrData = undefined;
    mockSwrError = undefined;
    mockSwrLoading = false;
  });

  it('returns empty array when no data', () => {
    const { result } = renderHook(() => useSubscriptions());
    expect(result.current.subscriptions).toEqual([]);
  });

  it('returns subscriptions from SWR data', () => {
    mockSwrData = [{ id: 1, frequency: 'monthly', status: 'active', nextDeliveryAt: '2026-04-01', createdAt: '2026-01-01', items: [] }];

    const { result } = renderHook(() => useSubscriptions());
    expect(result.current.subscriptions).toHaveLength(1);
    expect(result.current.subscriptions[0].id).toBe(1);
  });

  it('returns error state', () => {
    mockSwrError = new Error('Failed');

    const { result } = renderHook(() => useSubscriptions());
    expect(result.current.error).toBeDefined();
  });

  it('returns loading state', () => {
    mockSwrLoading = true;

    const { result } = renderHook(() => useSubscriptions());
    expect(result.current.isLoading).toBe(true);
  });

  it('provides mutate function', () => {
    const { result } = renderHook(() => useSubscriptions());
    expect(result.current.mutate).toBe(mockMutate);
  });
});

describe('useCreateSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1 };
    mockSwrData = [];
  });

  it('calls apiClient.post with correct payload', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateSubscription());

    await result.current.createSubscription({
      frequency: 'monthly',
      items: [{ productId: 1, quantity: 2 }],
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/me/subscriptions', {
      frequency: 'monthly',
      items: [{ productId: 1, quantity: 2 }],
    });
  });

  it('mutates SWR cache on success', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateSubscription());

    await result.current.createSubscription({
      frequency: 'weekly',
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(mockMutate).toHaveBeenCalled();
  });
});

describe('usePauseSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1 };
    mockSwrData = [];
  });

  it('calls apiClient.patch with paused status', async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const { result } = renderHook(() => usePauseSubscription());
    await result.current.pauseSubscription(1);

    expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/me/subscriptions/1', { status: 'paused' });
  });
});

describe('useResumeSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1 };
    mockSwrData = [];
  });

  it('calls apiClient.patch with active status', async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useResumeSubscription());
    await result.current.resumeSubscription(1);

    expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/me/subscriptions/1', { status: 'active' });
  });
});

describe('useCancelSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1 };
    mockSwrData = [];
  });

  it('calls apiClient.delete', async () => {
    (apiClient.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCancelSubscription());
    await result.current.cancelSubscription(5);

    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/me/subscriptions/5');
  });

  it('mutates SWR cache on success', async () => {
    (apiClient.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCancelSubscription());
    await result.current.cancelSubscription(5);

    expect(mockMutate).toHaveBeenCalled();
  });
});
