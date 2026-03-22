const BASE_URL = 'https://seller-api.rozetka.com.ua/';

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
      const res = await fetch(`${BASE_URL}sites`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.apiKey, password: this.apiKey }),
        signal: AbortSignal.timeout(15000),
      });

      const data: RozetkaAuthResponse = await res.json();

      if (!res.ok || !data.content?.token) {
        const errorMsg = data.errors?.[0]?.message || `HTTP ${res.status}`;
        console.error('[Rozetka] Помилка авторизації:', errorMsg);
        throw new Error(`Помилка авторизації Rozetka: ${errorMsg}`);
      }

      this.authToken = data.content.token;
      // Token valid for ~24h, refresh at 23h
      this.tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;

      return this.authToken;
    } catch (error) {
      console.error('[Rozetka] authenticate error:', error);
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

    const res = await fetch(url, {
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
        `items?page=${page}&per_page=${limit}`
      );
      return {
        items: data.content?.items || [],
        total: data.content?.total || 0,
      };
    } catch (error) {
      console.error('[Rozetka] getProducts error:', error);
      return { items: [], total: 0 };
    }
  }

  async createProduct(data: {
    name: string;
    description?: string;
    price: number;
    article?: string;
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
      console.error('[Rozetka] createProduct error:', message);
      return { success: false, error: message };
    }
  }

  async updateProduct(
    externalId: string,
    data: { name?: string; price?: number; quantity?: number; description?: string }
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
      console.error('[Rozetka] updateProduct error:', message);
      return { success: false, error: message };
    }
  }

  async updateStock(externalId: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    return this.updateProduct(externalId, { quantity });
  }

  async getOrders(dateFrom?: string, dateTo?: string): Promise<RozetkaOrder[]> {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const query = params.toString() ? `?${params.toString()}` : '';

      const data = await this.request<RozetkaOrdersResponse>(`orders/search${query}`);
      return data.content?.orders || [];
    } catch (error) {
      console.error('[Rozetka] getOrders error:', error);
      return [];
    }
  }
}
