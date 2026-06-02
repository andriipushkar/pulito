import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import { fetchWithMarketplaceRetry } from '@/services/marketplace-retry';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('rozetka', { platform: 'rozetka' });

// Official host is api-seller (hyphen after "api"). The seller-api.* form does
// NOT resolve — it silently broke the entire Rozetka sync path.
const BASE_URL = 'https://api-seller.rozetka.com.ua/';

interface RozetkaAuthResponse {
  success: boolean;
  content?: { token: string };
  errors?: { message: string }[];
}

interface RozetkaProductsResponse {
  success: boolean;
  content?: {
    items: RozetkaProduct[];
    total: number;
  };
  errors?: { message: string }[];
}

interface RozetkaProduct {
  id: number;
  name: string;
  price: number;
  quantity: number;
  status: string;
  article: string;
}

export interface RozetkaReturn {
  id: number;
  order_id: number;
  status: string;
  reason: string;
  quantity: number;
  refund_amount: number;
  created: string;
}

interface RozetkaReturnsResponse {
  success: boolean;
  content?: {
    returns: RozetkaReturn[];
    total: number;
  };
  errors?: { message: string }[];
}

interface RozetkaOrdersResponse {
  success: boolean;
  content?: {
    orders: RozetkaOrder[];
    total: number;
  };
  errors?: { message: string }[];
}

interface RozetkaOrder {
  id: number;
  status: string;
  amount: number;
  created: string;
  buyer: { name: string; phone: string; email?: string };
  items: { id: number; name: string; quantity: number; price: number }[];
  delivery?: { type: string; address?: string };
}

export class RozetkaClient {
  private apiKey: string;
  private shopId?: string;
  private authToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(apiKey: string, shopId?: string) {
    this.apiKey = apiKey;
    this.shopId = shopId;
  }

  async authenticate(): Promise<string> {
    try {
      recordMarketplaceCall('rozetka');
      // Docs: POST /sites with { username, password: base64(password) }.
      // The stored apiKey holds "login:password"; split on the first colon.
      const sep = this.apiKey.indexOf(':');
      const username = sep >= 0 ? this.apiKey.slice(0, sep) : this.apiKey;
      const password = sep >= 0 ? this.apiKey.slice(sep + 1) : this.apiKey;
      const res = await fetch(`${BASE_URL}sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password: Buffer.from(password, 'utf-8').toString('base64'),
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data: RozetkaAuthResponse = await res.json();

      if (!res.ok || !data.content?.token) {
        const errorMsg = data.errors?.[0]?.message || `HTTP ${res.status}`;
        log.error('Помилка авторизації Rozetka', { httpStatus: res.status, errorMsg });
        throw new Error(`Помилка авторизації Rozetka: ${errorMsg}`);
      }

      this.authToken = data.content.token;
      // Token valid for ~24h, refresh at 23h
      this.tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;

      return this.authToken;
    } catch (error) {
      log.error('authenticate error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async getToken(): Promise<string> {
    if (!this.authToken || Date.now() >= this.tokenExpiresAt) {
      await this.authenticate();
    }
    return this.authToken!;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const url = `${BASE_URL}${path.replace(/^\//, '')}`;

    recordMarketplaceCall('rozetka');
    const res = await fetchWithMarketplaceRetry(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.errors?.[0]?.message || `HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }

  async getProducts(page = 1, limit = 20): Promise<{ items: RozetkaProduct[]; total: number }> {
    try {
      const data = await this.request<RozetkaProductsResponse>(
        `items?page=${page}&per_page=${limit}`,
      );
      return {
        items: data.content?.items || [],
        total: data.content?.total || 0,
      };
    } catch (error) {
      log.error('getProducts error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { items: [], total: 0 };
    }
  }

  async createProduct(data: {
    name: string;
    description?: string;
    price: number;
    article?: string;
    barcode?: string;
    quantity?: number;
    images?: string[];
  }): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const body = {
        name: data.name,
        name_ua: data.name,
        description: data.description || '',
        description_ua: data.description || '',
        price: data.price,
        old_price: 0,
        currency: 'UAH',
        article: data.article || '',
        ...(data.barcode ? { barcode: data.barcode } : {}),
        quantity: data.quantity ?? 1,
        status: 'active',
        images: (data.images || []).slice(0, 10).map((url) => ({ url })),
      };

      const result = await this.request<{ content?: { id: number } }>('items', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (result.content?.id) {
        return { success: true, externalId: String(result.content.id) };
      }
      return { success: false, error: 'Не вдалося створити товар' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rozetka API error';
      log.error('createProduct error', { error: message });
      return { success: false, error: message };
    }
  }

  async updateProduct(
    externalId: string,
    data: { name?: string; price?: number; quantity?: number; description?: string },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const body: Record<string, unknown> = {};
      if (data.name) body.name = data.name;
      if (data.description) body.description = data.description;
      if (data.price !== undefined) body.price = data.price;
      if (data.quantity !== undefined) body.quantity = data.quantity;

      await this.request(`items/${externalId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rozetka API error';
      log.error('updateProduct error', { externalId, error: message });
      return { success: false, error: message };
    }
  }

  async updateStock(
    externalId: string,
    quantity: number,
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateProduct(externalId, { quantity });
  }

  async getOrders(dateFrom?: string, dateTo?: string): Promise<RozetkaOrder[]> {
    // Paginate so a large seller isn't truncated to the first page. Bounded:
    // stops on a short page, when no new ids arrive (API ignored paging), or at
    // PAGE_CAP — safe even if the endpoint doesn't support these params.
    const PER_PAGE = 50;
    const PAGE_CAP = 40;
    const acc = new Map<number, RozetkaOrder>();
    try {
      for (let page = 1; page <= PAGE_CAP; page++) {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        params.set('per_page', String(PER_PAGE));
        params.set('page', String(page));

        const data = await this.request<RozetkaOrdersResponse>(
          `orders/search?${params.toString()}`,
        );
        const batch = data.content?.orders || [];
        if (batch.length === 0) break;
        const before = acc.size;
        for (const o of batch) acc.set(o.id, o);
        if (acc.size === before) break;
        if (batch.length < PER_PAGE) break;
        if (page === PAGE_CAP) {
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

  async getReturns(dateFrom?: string): Promise<RozetkaReturn[]> {
    const PER_PAGE = 50;
    const PAGE_CAP = 40;
    const acc = new Map<number, RozetkaReturn>();
    try {
      for (let page = 1; page <= PAGE_CAP; page++) {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        params.set('per_page', String(PER_PAGE));
        params.set('page', String(page));

        const data = await this.request<RozetkaReturnsResponse>(
          `returns/search?${params.toString()}`,
        );
        const batch = data.content?.returns || [];
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
