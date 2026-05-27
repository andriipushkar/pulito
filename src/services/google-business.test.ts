import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/settings', () => ({
  getSettings: vi.fn(),
}));

vi.mock('@/services/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { LONG: 3600 },
}));

import { getSettings } from '@/services/settings';
import {
  GoogleBusinessError,
  getPlaceDetails,
  getWriteReviewUrl,
  isConfigured,
} from './google-business';
import { DEFAULT_SETTINGS } from '@/types/settings';

const mockSettings = vi.mocked(getSettings);

// Spread DEFAULT_SETTINGS so test stays valid when new keys are added.
const baseSettings = {
  ...DEFAULT_SETTINGS,
  site_name: 'Test',
  site_phone: '+1',
  site_phone_display: '+1',
  site_email: 't@t',
  free_delivery_threshold: '0',
} as const;

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('isConfigured', () => {
  it('returns false when api key missing', async () => {
    mockSettings.mockResolvedValue({ ...baseSettings, google_business_place_id: 'ChIJxx' });
    expect(await isConfigured()).toBe(false);
  });

  it('returns false when place id missing', async () => {
    mockSettings.mockResolvedValue({ ...baseSettings, google_maps_api_key: 'key' });
    expect(await isConfigured()).toBe(false);
  });

  it('returns true when both set', async () => {
    mockSettings.mockResolvedValue({
      ...baseSettings,
      google_maps_api_key: 'key',
      google_business_place_id: 'ChIJxx',
    });
    expect(await isConfigured()).toBe(true);
  });
});

describe('getWriteReviewUrl', () => {
  it('returns null when no place id', async () => {
    mockSettings.mockResolvedValue(baseSettings);
    expect(await getWriteReviewUrl()).toBeNull();
  });

  it('builds correct review url', async () => {
    mockSettings.mockResolvedValue({ ...baseSettings, google_business_place_id: 'ChIJtest' });
    expect(await getWriteReviewUrl()).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJtest',
    );
  });
});

describe('getPlaceDetails', () => {
  it('throws 503 when not configured', async () => {
    mockSettings.mockResolvedValue(baseSettings);
    await expect(getPlaceDetails()).rejects.toThrow(GoogleBusinessError);
  });

  it('parses Google API response', async () => {
    mockSettings.mockResolvedValue({
      ...baseSettings,
      google_maps_api_key: 'key',
      google_business_place_id: 'ChIJxx',
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'OK',
          result: {
            name: 'Pulito',
            formatted_address: 'Kyiv',
            rating: 4.7,
            user_ratings_total: 152,
            url: 'https://maps.google.com/?cid=1',
            formatted_phone_number: '+380...',
            website: 'https://pulito.trade',
            reviews: [
              {
                author_name: 'Олег',
                rating: 5,
                text: 'Чудовий сервіс',
                relative_time_description: 'тиждень тому',
                time: 1700000000,
              },
              {
                author_name: 'Ірина',
                rating: 4,
                text: 'Рекомендую',
                relative_time_description: 'місяць тому',
                time: 1690000000,
              },
            ],
          },
        }),
    } as never);

    const result = await getPlaceDetails(true);
    expect(result.name).toBe('Pulito');
    expect(result.rating).toBe(4.7);
    expect(result.totalRatings).toBe(152);
    expect(result.reviews).toHaveLength(2);
    // Sorted desc by time
    expect(result.reviews[0].authorName).toBe('Олег');
    expect(result.reviewUrl).toBe('https://search.google.com/local/writereview?placeid=ChIJxx');
  });

  it('throws on non-OK status from Google', async () => {
    mockSettings.mockResolvedValue({
      ...baseSettings,
      google_maps_api_key: 'key',
      google_business_place_id: 'ChIJxx',
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'INVALID_REQUEST', error_message: 'Bad place id' }),
    } as never);
    await expect(getPlaceDetails(true)).rejects.toThrow(/INVALID_REQUEST/);
  });

  it('throws on non-2xx HTTP', async () => {
    mockSettings.mockResolvedValue({
      ...baseSettings,
      google_maps_api_key: 'key',
      google_business_place_id: 'ChIJxx',
    });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as never);
    await expect(getPlaceDetails(true)).rejects.toThrow(/502|500/);
  });
});
