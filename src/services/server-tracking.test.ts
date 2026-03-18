import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://test.com', JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '' },
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

import { trackPurchase, trackAddToCart, trackFacebookEvent, trackGA4Event } from './server-tracking';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('FACEBOOK_PIXEL_ID', '');
  vi.stubEnv('FACEBOOK_CAPI_TOKEN', '');
  vi.stubEnv('GA4_MEASUREMENT_ID', '');
  vi.stubEnv('GA4_API_SECRET', '');
});

describe('trackFacebookEvent', () => {
  it('does nothing without FACEBOOK_PIXEL_ID', async () => {
    await trackFacebookEvent({ eventName: 'Purchase', value: 100 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends event when configured', async () => {
    vi.stubEnv('FACEBOOK_PIXEL_ID', '123456');
    vi.stubEnv('FACEBOOK_CAPI_TOKEN', 'token123');
    await trackFacebookEvent({ eventName: 'Purchase', value: 100, email: 'test@test.com' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('trackGA4Event', () => {
  it('does nothing without GA4_MEASUREMENT_ID', async () => {
    await trackGA4Event({ eventName: 'purchase', value: 100 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends event when configured', async () => {
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-TEST');
    vi.stubEnv('GA4_API_SECRET', 'secret');
    await trackGA4Event({ eventName: 'purchase', value: 100, userId: 1 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('google-analytics.com'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('trackPurchase', () => {
  it('calls both Facebook and GA4', async () => {
    vi.stubEnv('FACEBOOK_PIXEL_ID', '123');
    vi.stubEnv('FACEBOOK_CAPI_TOKEN', 'tok');
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-X');
    vi.stubEnv('GA4_API_SECRET', 'sec');

    await trackPurchase({
      orderId: 'ORD-001',
      totalAmount: 500,
      items: [{ id: '1', name: 'Product', price: 250, quantity: 2 }],
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not fail when APIs are not configured', async () => {
    await trackPurchase({
      orderId: 'ORD-002',
      totalAmount: 100,
      items: [],
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('trackAddToCart', () => {
  it('sends add_to_cart event', async () => {
    vi.stubEnv('GA4_MEASUREMENT_ID', 'G-X');
    vi.stubEnv('GA4_API_SECRET', 'sec');

    await trackAddToCart({ itemId: '1', itemName: 'Test', price: 100, quantity: 1 });
    expect(mockFetch).toHaveBeenCalled();
  });
});
