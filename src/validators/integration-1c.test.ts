import { describe, it, expect } from 'vitest';
import {
  oneCProductSchema,
  oneCProductsImportSchema,
  oneCOrderStatusSchema,
  oneCOrderStatusBatchSchema,
  oneCStockItemSchema,
  oneCStockUpdateSchema,
  oneCPriceItemSchema,
  oneCPriceUpdateSchema,
} from './integration-1c';

describe('oneCProductSchema', () => {
  it('validates valid product', () => {
    const result = oneCProductSchema.safeParse({ code: 'P1', name: 'Product 1' });
    expect(result.success).toBe(true);
  });

  it('rejects empty code', () => {
    const result = oneCProductSchema.safeParse({ code: '', name: 'Product' });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = oneCProductSchema.safeParse({
      code: 'P1', name: 'Product', priceRetail: 100, quantity: 10, barcode: '123', isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative price', () => {
    const result = oneCProductSchema.safeParse({ code: 'P1', name: 'Product', priceRetail: -1 });
    expect(result.success).toBe(false);
  });
});

describe('oneCProductsImportSchema', () => {
  it('validates array of products', () => {
    const result = oneCProductsImportSchema.safeParse({ products: [{ code: 'P1', name: 'Test' }] });
    expect(result.success).toBe(true);
  });

  it('rejects empty array', () => {
    const result = oneCProductsImportSchema.safeParse({ products: [] });
    expect(result.success).toBe(false);
  });
});

describe('oneCOrderStatusSchema', () => {
  it('validates valid order status', () => {
    const result = oneCOrderStatusSchema.safeParse({ orderNumber: 'ORD-001', status: 'shipped' });
    expect(result.success).toBe(true);
  });

  it('accepts optional trackingNumber', () => {
    const result = oneCOrderStatusSchema.safeParse({ orderNumber: 'ORD-001', status: 'shipped', trackingNumber: 'TRK123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty orderNumber', () => {
    const result = oneCOrderStatusSchema.safeParse({ orderNumber: '', status: 'shipped' });
    expect(result.success).toBe(false);
  });
});

describe('oneCOrderStatusBatchSchema', () => {
  it('validates batch of orders', () => {
    const result = oneCOrderStatusBatchSchema.safeParse({ orders: [{ orderNumber: 'O1', status: 'done' }] });
    expect(result.success).toBe(true);
  });

  it('rejects empty orders array', () => {
    const result = oneCOrderStatusBatchSchema.safeParse({ orders: [] });
    expect(result.success).toBe(false);
  });
});

describe('oneCStockItemSchema', () => {
  it('validates valid stock item', () => {
    const result = oneCStockItemSchema.safeParse({ code: 'P1', quantity: 50 });
    expect(result.success).toBe(true);
  });

  it('rejects negative quantity', () => {
    const result = oneCStockItemSchema.safeParse({ code: 'P1', quantity: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer quantity', () => {
    const result = oneCStockItemSchema.safeParse({ code: 'P1', quantity: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe('oneCStockUpdateSchema', () => {
  it('validates stock update', () => {
    const result = oneCStockUpdateSchema.safeParse({ stock: [{ code: 'P1', quantity: 10 }] });
    expect(result.success).toBe(true);
  });
});

describe('oneCPriceItemSchema', () => {
  it('validates valid price item', () => {
    const result = oneCPriceItemSchema.safeParse({ code: 'P1', priceRetail: 100 });
    expect(result.success).toBe(true);
  });

  it('accepts multiple price tiers', () => {
    const result = oneCPriceItemSchema.safeParse({ code: 'P1', priceRetail: 100, priceWholesale: 80, priceWholesale2: 70, priceWholesale3: 60 });
    expect(result.success).toBe(true);
  });
});

describe('oneCPriceUpdateSchema', () => {
  it('validates price update', () => {
    const result = oneCPriceUpdateSchema.safeParse({ prices: [{ code: 'P1', priceRetail: 100 }] });
    expect(result.success).toBe(true);
  });

  it('rejects empty prices array', () => {
    const result = oneCPriceUpdateSchema.safeParse({ prices: [] });
    expect(result.success).toBe(false);
  });
});
