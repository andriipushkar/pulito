import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import { fetchWithMarketplaceRetry } from '@/services/marketplace-retry';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('prom', { platform: 'prom' });

const BASE_URL = 'https://my.prom.ua/api/v1/';

interface PromProduct {
  id: number;
  name: string;
  price: number;
  quantity_in_stock: number;
  status: string;
  sku: string;
}

export interface PromReturn {
  id: number;
  order_id: number;
  status: string;
  reason: string;
  quantity: number;
  refund_amount: number;
  date_created: string;
}

interface PromOrder {
  id: number;
  status: string;
  price: string;
  date_created: string;
  client_first_name: string;
  client_last_name: string;
  phone: string;
  email?: string;
  products: { id: number; name: string; quantity: number; price: string }[];
  delivery_option?: { name: string };
  delivery_address?: string;
}

export class PromClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path.replace(/^\//, '')}`;

    recordMarketplaceCall('prom');
    const res = await fetchWithMarketplaceRetry(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.message || data.error || `HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }

  // Currently unused in production (sync goes through products/edit + YML feed).
  // Before wiring this into an import flow, verify the token's company scope:
  // products/list returns everything the token can see, with no owner filter.
  async getProducts(page = 1, limit = 20): Promise<{ items: PromProduct[]; total: number }> {
    try {
      const data = await this.request<{ products: PromProduct[]; _meta?: { total: number } }>(
        `products/list?limit=${limit}&offset=${(page - 1) * limit}`,
      );
      return {
        items: data.products || [],
        total: data._meta?.total || data.products?.length || 0,
      };
    } catch (error) {
      log.error('getProducts error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { items: [], total: 0 };
    }
  }

  // Prom.ua has no product-creation API — new products are imported via the YML
  // feed (/api/v1/feeds/prom.xml) in the Prom cabinet. We accept the same shape
  // as other clients for call-site compatibility but never hit the API (an
  // API "create" would silently no-op).
  async createProduct(_data?: {
    name: string;
    description?: string;
    price: number;
    sku?: string;
    barcode?: string;
    quantity?: number;
    images?: string[];
  }): Promise<{ success: boolean; externalId?: string; error?: string }> {
    void _data;
    return {
      success: false,
      error:
        'Prom.ua не створює товари через API — підключіть YML-фід (/api/v1/feeds/prom.xml) у кабінеті Prom → Імпорт.',
    };
  }

  async updateProduct(
    externalId: string,
    // name/description accepted for call-site compatibility but ignored — Prom's
    // products/edit cannot change them (they come from the YML import feed).
    data: { name?: string; description?: string; price?: number; quantity?: number },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // products/edit takes {products:[{id,...}]} and edits only price/presence/
      // quantity/status. name/description/images come from the import feed.
      const product: Record<string, unknown> = { id: Number(externalId) };
      if (data.price !== undefined) product.price = data.price;
      if (data.quantity !== undefined) {
        product.quantity_in_stock = data.quantity;
        product.presence = data.quantity > 0 ? 'available' : 'not_available';
      }

      await this.request('products/edit', {
        method: 'POST',
        body: JSON.stringify({ products: [product] }),
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prom.ua API error';
      log.error('updateProduct error', { error: message });
      return { success: false, error: message };
    }
  }

  async updateStock(
    externalId: string,
    quantity: number,
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateProduct(externalId, { quantity });
  }

  async getOrders(dateFrom?: string, dateTo?: string): Promise<PromOrder[]> {
    // Paginate so a seller with many orders in the window isn't truncated to the
    // first page. Bounded: stops on a short page, when a page brings no new ids
    // (API ignored offset), or at PAGE_CAP — so it can't loop forever.
    const PER_PAGE = 50;
    const PAGE_CAP = 40;
    const acc = new Map<number, PromOrder>();
    try {
      for (let page = 0; page < PAGE_CAP; page++) {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        params.set('status', 'pending,accepted,ready,delivered');
        params.set('limit', String(PER_PAGE));
        params.set('offset', String(page * PER_PAGE));

        const data = await this.request<{ orders: PromOrder[] }>(
          `orders/list?${params.toString()}`,
        );
        const batch = data.orders || [];
        if (batch.length === 0) break;
        const before = acc.size;
        for (const o of batch) acc.set(o.id, o);
        if (acc.size === before) break;
        if (batch.length < PER_PAGE) break;
        if (page === PAGE_CAP - 1) {
          log.error('getOrders hit PAGE_CAP — orders may be truncated', { fetched: acc.size });
        }
      }
      return Array.from(acc.values());
    } catch (error) {
      log.error('getOrders error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return Array.from(acc.values());
    }
  }

  async getReturns(dateFrom?: string): Promise<PromReturn[]> {
    const PER_PAGE = 50;
    const PAGE_CAP = 40;
    const acc = new Map<number, PromReturn>();
    try {
      for (let page = 0; page < PAGE_CAP; page++) {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        params.set('limit', String(PER_PAGE));
        params.set('offset', String(page * PER_PAGE));

        const data = await this.request<{ returns: PromReturn[] }>(
          `returns/list?${params.toString()}`,
        );
        const batch = data.returns || [];
        if (batch.length === 0) break;
        const before = acc.size;
        for (const r of batch) acc.set(r.id, r);
        if (acc.size === before) break;
        if (batch.length < PER_PAGE) break;
      }
      return Array.from(acc.values());
    } catch (error) {
      log.error('getReturns error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return Array.from(acc.values());
    }
  }
}
