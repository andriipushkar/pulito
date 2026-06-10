import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromClient } from './marketplace-prom';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

let client: PromClient;

beforeEach(() => {
  vi.clearAllMocks();
  client = new PromClient('test-api-token');
});

describe('PromClient', () => {
  describe('getProducts', () => {
    it('should fetch products with pagination', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          products: [
            {
              id: 1,
              name: 'Prod',
              price: 100,
              quantity_in_stock: 5,
              status: 'on_display',
              sku: 'S1',
            },
          ],
          _meta: { total: 100 },
        }),
      );

      const result = await client.getProducts(3, 25);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(100);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('limit=25');
      expect(url).toContain('offset=50'); // (3-1)*25
    });

    it('should return empty items on error', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401));

      const result = await client.getProducts();

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('createProduct', () => {
    // Prom.ua has no product-creation API — products are imported via the YML
    // feed, so createProduct must refuse without calling the network.
    it('should return explanatory error and not call the API', async () => {
      const result = await client.createProduct({
        name: 'New Prom Product',
        price: 300,
        sku: 'NP-1',
        quantity: 20,
        images: ['img.jpg'],
      });

      expect(result.success).toBe(false);
      expect(result.externalId).toBeUndefined();
      expect(result.error).toContain('YML');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    it('should send products/edit payload with price only (name is feed-owned)', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'ok' }));

      const result = await client.updateProduct('10', { name: 'Updated', price: 150 });

      expect(result).toEqual({ success: true });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.products).toHaveLength(1);
      expect(body.products[0].id).toBe(10); // Number(externalId)
      expect(body.products[0].price).toBe(150);
      // name/description come from the YML import feed and must not be sent
      expect(body.products[0].name).toBeUndefined();
    });

    it('should return error on failure', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Product not found' }, 404));

      const result = await client.updateProduct('999', { price: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Product not found');
    });
  });

  describe('updateStock', () => {
    it('should update quantity via updateProduct', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'ok' }));

      const result = await client.updateStock('20', 99);

      expect(result).toEqual({ success: true });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.products[0].quantity_in_stock).toBe(99);
      expect(body.products[0].presence).toBe('available');
    });
  });

  describe('getOrders', () => {
    it('should fetch orders with date filters', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          orders: [
            {
              id: 10,
              status: 'pending',
              price: '1000',
              date_created: '2024-01-15',
              client_first_name: 'Іван',
              client_last_name: 'Петренко',
              phone: '+380501234567',
              products: [{ id: 1, name: 'Товар', quantity: 2, price: '500' }],
            },
          ],
        }),
      );

      const orders = await client.getOrders('2024-01-01', '2024-01-31');

      expect(orders).toHaveLength(1);
      expect(orders[0].client_first_name).toBe('Іван');
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('date_from=2024-01-01');
      expect(url).toContain('date_to=2024-01-31');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const orders = await client.getOrders();

      expect(orders).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle fetch rejection in request', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await client.getProducts();

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should pass Authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ products: [], _meta: { total: 0 } }));

      await client.getProducts();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer test-api-token');
    });
  });
});
