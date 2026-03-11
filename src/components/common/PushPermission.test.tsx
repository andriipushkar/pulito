// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

import PushPermission from './PushPermission';

function setupPushSupport(opts: { existingSub?: any } = {}) {
  const mockUnsubscribe = vi.fn().mockResolvedValue(true);
  const mockSubscription = opts.existingSub || null;
  const mockSubscribe = vi.fn().mockResolvedValue({
    toJSON: () => ({ endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } }),
  });

  const mockPushManager = {
    getSubscription: vi.fn().mockResolvedValue(mockSubscription),
    subscribe: mockSubscribe,
  };

  const mockRegistration = { pushManager: mockPushManager };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve(mockRegistration),
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'PushManager', {
    value: class {},
    writable: true,
    configurable: true,
  });

  return { mockPushManager, mockRegistration, mockSubscribe, mockUnsubscribe, mockSubscription };
}

describe('PushPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ success: true, data: { publicKey: 'test-public-key' } });
    mockApiPost.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    delete (window as any).PushManager;
    delete (navigator as any).serviceWorker;
  });

  it('returns null when Push API not supported', () => {
    const { container } = render(<PushPermission />);
    expect(container.innerHTML).toBe('');
  });

  it('renders subscribe button when Push is supported but not subscribed', async () => {
    setupPushSupport();
    const { findByText } = render(<PushPermission />);
    expect(await findByText('Увімкнути сповіщення')).toBeInTheDocument();
  });

  it('renders unsubscribe button when already subscribed', async () => {
    setupPushSupport({
      existingSub: {
        endpoint: 'https://push.example.com',
        unsubscribe: vi.fn().mockResolvedValue(true),
      },
    });
    const { findByText } = render(<PushPermission />);
    expect(await findByText('Вимкнути сповіщення')).toBeInTheDocument();
  });

  it('unsubscribes when unsubscribe button clicked', async () => {
    const mockUnsub = vi.fn().mockResolvedValue(true);
    setupPushSupport({
      existingSub: {
        endpoint: 'https://push.example.com',
        unsubscribe: mockUnsub,
      },
    });
    const { findByText } = render(<PushPermission />);
    const btn = await findByText('Вимкнути сповіщення');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/push/unsubscribe', {
      endpoint: 'https://push.example.com',
    });
    expect(mockUnsub).toHaveBeenCalled();
  });

  it('renders button element when push is supported', async () => {
    setupPushSupport();
    const { findByRole } = render(<PushPermission />);
    const button = await findByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('subscribes when subscribe button is clicked', async () => {
    const { mockSubscribe } = setupPushSupport();
    const { findByText } = render(<PushPermission />);
    const btn = await findByText('Увімкнути сповіщення');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/push/subscribe');
    expect(mockSubscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/push/subscribe', {
      endpoint: 'https://push.example.com',
      keys: { p256dh: 'key1', auth: 'key2' },
    });
  });

  it('shows subscribed state after subscribing', async () => {
    setupPushSupport();
    const { findByText } = render(<PushPermission />);
    const btn = await findByText('Увімкнути сповіщення');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(await findByText('Вимкнути сповіщення')).toBeInTheDocument();
  });

  it('does not subscribe when VAPID key fetch fails', async () => {
    mockApiGet.mockResolvedValue({ success: false });
    const { mockSubscribe } = setupPushSupport();
    const { findByText } = render(<PushPermission />);
    const btn = await findByText('Увімкнути сповіщення');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('handles subscribe error gracefully', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    setupPushSupport();
    const { findByText } = render(<PushPermission />);
    const btn = await findByText('Увімкнути сповіщення');

    await act(async () => {
      fireEvent.click(btn);
    });

    // Should not crash, button should be re-enabled
    expect(await findByText('Увімкнути сповіщення')).toBeInTheDocument();
  });

  it('handles unsubscribe error gracefully', async () => {
    const mockUnsub = vi.fn().mockRejectedValue(new Error('unsub error'));
    setupPushSupport({
      existingSub: {
        endpoint: 'https://push.example.com',
        unsubscribe: mockUnsub,
      },
    });
    mockApiPost.mockRejectedValue(new Error('Network error'));
    const { findByText } = render(<PushPermission />);
    const btn = await findByText('Вимкнути сповіщення');

    await act(async () => {
      fireEvent.click(btn);
    });

    // Should not crash, re-enabled
    expect(await findByText('Вимкнути сповіщення')).toBeInTheDocument();
  });

  it('shows loading text while subscribing', async () => {
    let resolveGet: (v: any) => void;
    mockApiGet.mockReturnValue(new Promise((r) => { resolveGet = r; }));
    setupPushSupport();
    const { findByText } = render(<PushPermission />);
    const btn = await findByText('Увімкнути сповіщення');

    fireEvent.click(btn);
    expect(await findByText('Завантаження...')).toBeInTheDocument();

    await act(async () => {
      resolveGet!({ success: true, data: { publicKey: 'test-key' } });
    });
  });
});
