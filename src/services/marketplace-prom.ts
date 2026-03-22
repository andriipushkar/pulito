const BASE_URL = 'https://my.prom.ua/api/v1/';

interface PromProduct {
  id: number;
  name: string;
  price: number;
  quantity_in_stock: number;
  status: string;
  sku: string;
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
  delivery_option?: { name: string; };
  delivery_address?: string;
}

export class PromClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path.replace(/^\//, '')}`;

    const res = await fetch(url, {
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

  async getProducts(page = 1, limit = 20): Promise<{ items: PromProduct[]; total: number }> {
    try {
      const data = await this.request<{ products: PromProduct[]; _meta?: { total: number } }>(
        `products/list?limit=${limit}&offset=${(page - 1) * limit}`
      );
      return {
        items: data.products || [],
        total: data._meta?.total || data.products?.length || 0,
      };
    } catch (error) {
      console.error('[Prom] getProducts error:', error);
      return { items: [], total: 0 };
    }
  }

  async createProduct(data: {
    name: string;
    description?: string;
    price: number;
    sku?: string;
    quantity?: number;
    images?: string[];
  }): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const body = {
        name: data.name,
        description: data.description || '',
        price: data.price,
        currency: 'UAH',
        sku: data.sku || '',
        quantity_in_stock: data.quantity ?? 1,
        status: 'on_display',
        images: (data.images || []).slice(0, 12).map((url) => ({ url })),
      };

      const result = await this.request<{ id?: number; status?: string }>(
        'products/edit',
        { method: 'POST', body: JSON.stringify(body) }
      );

      if (result.id || result.status === 'ok') {
        return { success: true, externalId: result.id ? String(result.id) : undefined };
      }
      return { success: false, error: 'Не вдалося створити товар' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prom.ua API error';
      console.error('[Prom] createProduct error:', message);
      return { success: false, error: message };
    }
  }

  async updateProduct(
    externalId: string,
    data: { name?: string; price?: number; quantity?: number; description?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const body: Record<string, unknown> = { id: Number(externalId) };
      if (data.name) body.name = data.name;
      if (data.description) body.description = data.description;
      if (data.price !== undefined) body.price = data.price;
      if (data.quantity !== undefined) body.quantity_in_stock = data.quantity;

      await this.request('products/edit', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prom.ua API error';
      console.error('[Prom] updateProduct error:', message);
      return { success: false, error: message };
    }
  }

  async updateStock(externalId: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    return this.updateProduct(externalId, { quantity });
  }

  async getOrders(dateFrom?: string, dateTo?: string): Promise<PromOrder[]> {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('status', 'pending,accepted,ready,delivered');
      const query = params.toString() ? `?${params.toString()}` : '';

      const data = await this.request<{ orders: PromOrder[] }>(`orders/list${query}`);
      return data.orders || [];
    } catch (error) {
      console.error('[Prom] getOrders error:', error);
      return [];
    }
  }
}
