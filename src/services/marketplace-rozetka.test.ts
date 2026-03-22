import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RozetkaClient } from './marketplace-rozetka';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

let client: RozetkaClient;

beforeEach(() => {
  vi.clearAllMocks();
  client = new RozetkaClient('test-api-key', 'shop-123');
});

describe('RozetkaClient', () => {
  describe('authenticate', () => {
    it('should get token on successful auth', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ success: true, content: { token: 'my-token' } }),
      );

      const token = await client.authenticate();

      expect(token).toBe('my-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://seller-api.rozetka.com.ua/sites',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ username: 'test-api-key', password: 'test-api-key' }),
        }),
      );
    });

    it('should throw on auth failure', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ success: false, errors: [{ message: 'Invalid credentials' }] }, 401),
      );

      await expect(client.authenticate()).rejects.toThrow('Помилка авторизації Rozetka');
    });
  });

  describe('getProducts', () => {
    it('should fetch products with pagination', async () => {
      // First call: authenticate
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      // Second call: getProducts
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          content: {
            items: [{ id: 1, name: 'Prod', price: 100, quantity: 5, status: 'active', article: 'A1' }],
            total: 50,
          },
        }),
      );

      const result = await client.getProducts(2, 10);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(50);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Verify pagination params
      const url = mockFetch.mock.calls[1][0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('per_page=10');
    });

    it('should return empty items on error', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'Server error' }] }, 500),
      );

      const result = await client.getProducts();

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('createProduct', () => {
    it('should return externalId on success', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ content: { id: 999 } }),
      );

      const result = await client.createProduct({
        name: 'New Product',
        price: 250,
        article: 'NP-1',
        quantity: 10,
        images: ['img1.jpg'],
      });

      expect(result).toEqual({ success: true, externalId: '999' });
    });

    it('should return error on failure', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'Validation failed' }] }, 400),
      );

      const result = await client.createProduct({ name: 'Bad', price: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('updateProduct', () => {
    it('should update successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

      const result = await client.updateProduct('ext-1', { name: 'Updated', price: 300 });

      expect(result).toEqual({ success: true });
      const url = mockFetch.mock.calls[1][0] as string;
      expect(url).toContain('items/ext-1');
    });

    it('should return error on API failure', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'Not found' }] }, 404),
      );

      const result = await client.updateProduct('bad-id', { price: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not found');
    });
  });

  describe('updateStock', () => {
    it('should update quantity', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

      const result = await client.updateStock('ext-5', 42);

      expect(result).toEqual({ success: true });
      const body = JSON.parse(mockFetch.mock.calls[1][1].body as string);
      expect(body.quantity).toBe(42);
    });
  });

  describe('getOrders', () => {
    it('should fetch orders', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          content: {
            orders: [
              { id: 1, status: 'new', amount: 500, buyer: { name: 'Test', phone: '+380' }, items: [] },
            ],
            total: 1,
          },
        }),
      );

      const orders = await client.getOrders('2024-01-01', '2024-01-31');

      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe(1);
      const url = mockFetch.mock.calls[1][0] as string;
      expect(url).toContain('date_from=2024-01-01');
      expect(url).toContain('date_to=2024-01-31');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, content: { token: 'tok' } }),
      );
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const orders = await client.getOrders();

      expect(orders).toEqual([]);
    });
  });

  describe('API error handling', () => {
    it('should handle network fetch rejection gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'));

      await expect(client.authenticate()).rejects.toThrow('fetch failed');
    });
  });
});
