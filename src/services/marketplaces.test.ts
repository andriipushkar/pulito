import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetChannelConfig = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('@/services/channel-config', () => ({
  getChannelConfig: mockGetChannelConfig,
}));

vi.stubGlobal('fetch', mockFetch);

import {
  publishToOlx,
  publishToRozetka,
  publishToProm,
  publishToEpicentrk,
  publishToMarketplace,
  updateMarketplaceListing,
  deleteMarketplaceListing,
  syncMarketplacePrices,
  getMarketplaceMessages,
  replyToMarketplaceMessage,
  MARKETPLACE_CHANNELS,
} from './marketplaces';

beforeEach(() => {
  vi.clearAllMocks();
});

const APP_URL = 'https://pulito.trade';

const sampleListing = {
  title: 'Порошок Ariel 3кг',
  description: 'Високоякісний пральний порошок',
  price: 259.99,
  images: ['/uploads/img1.webp', 'https://cdn.example.com/img2.webp'],
  productCode: 'ARI-3',
  quantity: 50,
};

// ── OLX ──

describe('publishToOlx', () => {
  it('should return failed when OLX is not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToOlx(sampleListing, APP_URL);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('OLX не налаштовано');
  });

  it('should return failed when clientId is missing', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });

    const result = await publishToOlx(sampleListing, APP_URL);

    expect(result.status).toBe('failed');
  });

  it('should publish successfully', async () => {
    mockGetChannelConfig.mockResolvedValue({
      clientId: 'cid',
      accessToken: 'tok',
      defaultCategoryId: '42',
      contactName: 'Shop',
      contactPhone: '+380991234567',
      cityId: '10',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 12345, url: 'https://olx.ua/ad/12345' } }),
    });

    const result = await publishToOlx(sampleListing, APP_URL);

    expect(result.status).toBe('published');
    expect(result.externalId).toBe('12345');
    expect(result.permalink).toBe('https://olx.ua/ad/12345');
  });

  it('should truncate title to 70 chars for OLX', async () => {
    mockGetChannelConfig.mockResolvedValue({ clientId: 'c', accessToken: 't', defaultCategoryId: '1' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 1 } }),
    });

    const longTitle = 'A'.repeat(100);
    await publishToOlx({ ...sampleListing, title: longTitle }, APP_URL);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.title.length).toBe(70);
  });

  it('should prepend appUrl to relative image URLs', async () => {
    mockGetChannelConfig.mockResolvedValue({ clientId: 'c', accessToken: 't', defaultCategoryId: '1' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 1 } }),
    });

    await publishToOlx(sampleListing, APP_URL);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.images[0].url).toBe('https://pulito.trade/uploads/img1.webp');
    expect(body.images[1].url).toBe('https://cdn.example.com/img2.webp');
  });

  it('should limit images to 8 for OLX', async () => {
    mockGetChannelConfig.mockResolvedValue({ clientId: 'c', accessToken: 't', defaultCategoryId: '1' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 1 } }),
    });

    const manyImages = Array.from({ length: 15 }, (_, i) => `/img${i}.webp`);
    await publishToOlx({ ...sampleListing, images: manyImages }, APP_URL);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.images).toHaveLength(8);
  });

  it('should return failed on API error response', async () => {
    mockGetChannelConfig.mockResolvedValue({ clientId: 'c', accessToken: 't', defaultCategoryId: '1' });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid category' } }),
    });

    const result = await publishToOlx(sampleListing, APP_URL);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Invalid category');
  });

  it('should handle fetch network error', async () => {
    mockGetChannelConfig.mockResolvedValue({ clientId: 'c', accessToken: 't', defaultCategoryId: '1' });
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await publishToOlx(sampleListing, APP_URL);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Network error');
  });
});

// ── Rozetka ──

describe('publishToRozetka', () => {
  it('should return failed when not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToRozetka(sampleListing, APP_URL);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Rozetka не налаштовано');
  });

  it('should publish successfully', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiKey: 'key', sellerId: 'sid' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { id: 99 } }),
    });

    const result = await publishToRozetka(sampleListing, APP_URL);

    expect(result.status).toBe('published');
    expect(result.externalId).toBe('99');
    expect(result.permalink).toContain('rozetka.com.ua');
  });

  it('should return failed on API error', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiKey: 'key', sellerId: 'sid' });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ errors: [{ message: 'Validation failed' }] }),
    });

    const result = await publishToRozetka(sampleListing, APP_URL);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Validation failed');
  });
});

// ── Prom.ua ──

describe('publishToProm', () => {
  it('should return failed when not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToProm(sampleListing, APP_URL);
    expect(result.status).toBe('failed');
  });

  it('should publish successfully', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiToken: 'tok' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 777, status: 'ok' }),
    });

    const result = await publishToProm(sampleListing, APP_URL);

    expect(result.status).toBe('published');
    expect(result.externalId).toBe('777');
    expect(result.permalink).toContain('prom.ua');
  });

  it('should handle ok status without id', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiToken: 'tok' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const result = await publishToProm(sampleListing, APP_URL);
    expect(result.status).toBe('published');
    expect(result.externalId).toBe('');
  });
});

// ── Epicentr K ──

describe('publishToEpicentrk', () => {
  it('should return failed when not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToEpicentrk(sampleListing, APP_URL);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Epicentr K не налаштовано');
  });

  it('should publish successfully', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiKey: 'key', sellerId: 'sid' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 555 }),
    });

    const result = await publishToEpicentrk(sampleListing, APP_URL);

    expect(result.status).toBe('published');
    expect(result.externalId).toBe('555');
    expect(result.permalink).toContain('epicentrk.ua');
  });
});

// ── Dispatcher ──

describe('publishToMarketplace', () => {
  it('should dispatch to OLX', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToMarketplace('olx', sampleListing, APP_URL);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('OLX');
  });

  it('should dispatch to Rozetka', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToMarketplace('rozetka', sampleListing, APP_URL);
    expect(result.error).toContain('Rozetka');
  });

  it('should dispatch to Prom', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToMarketplace('prom', sampleListing, APP_URL);
    expect(result.error).toContain('Prom.ua');
  });

  it('should dispatch to Epicentr K', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await publishToMarketplace('epicentrk', sampleListing, APP_URL);
    expect(result.error).toContain('Epicentr K');
  });

  it('should return error for unknown marketplace', async () => {
    const result = await publishToMarketplace('amazon', sampleListing, APP_URL);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Невідомий маркетплейс');
  });
});

// ── Update listing ──

describe('updateMarketplaceListing', () => {
  it('should update OLX listing', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    const result = await updateMarketplaceListing('olx', '123', { price: 300 }, APP_URL);

    expect(result.status).toBe('published');
    expect(result.externalId).toBe('123');
  });

  it('should return failed when OLX not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const result = await updateMarketplaceListing('olx', '123', { price: 300 }, APP_URL);
    expect(result.status).toBe('failed');
  });

  it('should update Rozetka listing', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiKey: 'key' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    const result = await updateMarketplaceListing('rozetka', '456', { title: 'Updated' }, APP_URL);
    expect(result.status).toBe('published');
  });

  it('should update Prom listing', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    const result = await updateMarketplaceListing('prom', '789', { quantity: 10 }, APP_URL);
    expect(result.status).toBe('published');
  });

  it('should return error for unknown marketplace', async () => {
    const result = await updateMarketplaceListing('unknown', '1', {}, APP_URL);
    expect(result.status).toBe('failed');
  });
});

// ── Delete listing ──

describe('deleteMarketplaceListing', () => {
  it('should delete OLX listing', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await deleteMarketplaceListing('olx', '123');
    expect(result.status).toBe('published');
  });

  it('should succeed on 404 (already deleted)', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await deleteMarketplaceListing('olx', '123');
    expect(result.status).toBe('published');
  });

  it('should fail on server error', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await deleteMarketplaceListing('olx', '123');
    expect(result.status).toBe('failed');
  });

  it('should return error for unknown marketplace', async () => {
    const result = await deleteMarketplaceListing('amazon', '1');
    expect(result.status).toBe('failed');
  });

  it('should delete Prom listing by setting status to deleted', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await deleteMarketplaceListing('prom', '888');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.status).toBe('deleted');
    expect(body.id).toBe(888);
  });
});

// ── Sync prices ──

describe('syncMarketplacePrices', () => {
  it('should update all listings and count successes/failures', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });

    // First succeeds, second fails
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' });

    const listings = [
      { externalId: '1', price: 100, quantity: 10 },
      { externalId: '2', price: 200, quantity: 5 },
    ];

    const result = await syncMarketplacePrices('olx', listings, APP_URL);

    expect(result.updated).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('should handle empty listings', async () => {
    const result = await syncMarketplacePrices('olx', [], APP_URL);
    expect(result).toEqual({ updated: 0, failed: 0 });
  });

  it('should count exception as failure', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockRejectedValueOnce(new Error('HTTP 429: Too Many Requests'));

    const result = await syncMarketplacePrices(
      'olx',
      [{ externalId: '1', price: 100, quantity: 10 }],
      APP_URL,
    );

    // After retries exhaust, it should count as failed
    expect(result.failed).toBe(1);
  });
});

// ── Get messages ──

describe('getMarketplaceMessages', () => {
  it('should return OLX messages', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: '1',
            interlocutor: { name: 'Покупець' },
            last_message: { text: 'Чи є в наявності?' },
            advert: { title: 'Ariel', id: '100' },
            created_at: '2025-01-01T10:00:00Z',
            unread_count: 1,
          },
        ],
      }),
    });

    const messages = await getMarketplaceMessages('olx');

    expect(messages).toHaveLength(1);
    expect(messages[0].marketplace).toBe('olx');
    expect(messages[0].text).toBe('Чи є в наявності?');
    expect(messages[0].isRead).toBe(false);
  });

  it('should return empty array when not configured', async () => {
    mockGetChannelConfig.mockResolvedValue(null);

    const messages = await getMarketplaceMessages('olx');
    expect(messages).toEqual([]);
  });

  it('should return empty array on API error', async () => {
    mockGetChannelConfig.mockResolvedValue({ accessToken: 'tok' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const messages = await getMarketplaceMessages('olx');
    expect(messages).toEqual([]);
  });

  it('should return empty for unknown marketplace', async () => {
    const messages = await getMarketplaceMessages('amazon');
    expect(messages).toEqual([]);
  });

  it('should return Rozetka messages', async () => {
    mockGetChannelConfig.mockResolvedValue({ apiKey: 'key' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            id: '2',
            buyer_name: 'Олена',
            body: 'Доброго дня',
            item_id: '200',
            created: '2025-02-01',
            is_read: true,
          },
        ],
      }),
    });

    const messages = await getMarketplaceMessages('rozetka');

    expect(messages).toHaveLength(1);
    expect(messages[0].marketplace).toBe('rozetka');
    expect(messages[0].isRead).toBe(true);
  });
});

// ── Reply to message ──

describe('replyToMarketplaceMessage', () => {
  it('returns clear error for epicentrk (no public messages API)', async () => {
    const res = await replyToMarketplaceMessage('epicentrk', 'thread-1', 'Hello');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Epicentr K');
  });

  it('rejects empty text', async () => {
    const res = await replyToMarketplaceMessage('olx', 'thread-1', '   ');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Порожнє');
  });

  it('returns helpful error for unknown channel', async () => {
    const res = await replyToMarketplaceMessage('nope', 'thread-1', 'hi');
    expect(res.success).toBe(false);
    expect(res.error).toContain('не підтримується');
  });
});

// ── Constants ──

describe('MARKETPLACE_CHANNELS', () => {
  it('should contain all supported channels', () => {
    expect(MARKETPLACE_CHANNELS).toEqual(['olx', 'rozetka', 'prom', 'epicentrk']);
  });
});
