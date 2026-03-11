import { describe, it, expect, vi } from 'vitest';

vi.mock('@/validators/auth', () => ({
  registerSchema: { _def: {} },
  loginSchema: { _def: {} },
}));
vi.mock('@/validators/order', () => ({
  checkoutSchema: { _def: {} },
  updateOrderStatusSchema: { _def: {} },
}));
vi.mock('@/validators/payment', () => ({
  initiatePaymentSchema: { _def: {} },
}));
vi.mock('@/validators/pallet-delivery', () => ({
  calculatePalletCostSchema: { _def: {} },
  palletConfigSchema: { partial: () => ({ _def: {} }), _def: {} },
}));
vi.mock('@/validators/loyalty', () => ({
  adjustPointsSchema: { _def: {} },
}));
vi.mock('zod', () => ({
  z: {
    toJSONSchema: () => ({ type: 'object' }),
  },
}));

import { openApiDocument } from './swagger';

describe('swagger', () => {
  it('exports a valid OpenAPI 3.0 document', () => {
    expect(openApiDocument).toHaveProperty('openapi', '3.0.3');
    expect(openApiDocument).toHaveProperty('info');
    expect(openApiDocument.info).toHaveProperty('title');
    expect(openApiDocument.info).toHaveProperty('version', '1.0.0');
  });

  it('has paths and tags defined', () => {
    expect(openApiDocument).toHaveProperty('paths');
    expect(openApiDocument).toHaveProperty('tags');
    expect(Object.keys(openApiDocument.paths).length).toBeGreaterThan(0);
  });
});
