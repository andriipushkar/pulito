import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtends = vi.hoisted(() => vi.fn().mockReturnValue({}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $extends: mockExtends,
  },
}));

vi.mock('../../generated/prisma', () => ({
  PrismaClient: vi.fn(),
}));

import { createTenantPrisma } from './prisma-tenant';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTenantPrisma', () => {
  it('returns an extended prisma client', () => {
    const result = createTenantPrisma(42);
    expect(mockExtends).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it('passes query extension with $allOperations', () => {
    createTenantPrisma(42);
    const extensionArg = mockExtends.mock.calls[0][0];
    expect(extensionArg).toHaveProperty('query');
    expect(extensionArg.query).toHaveProperty('$allOperations');
    expect(typeof extensionArg.query.$allOperations).toBe('function');
  });

  it('$allOperations passes through queries for non-scoped models', () => {
    createTenantPrisma(42);
    const allOps = mockExtends.mock.calls[0][0].query.$allOperations;
    const mockQuery = vi.fn().mockReturnValue('result');

    const result = allOps({
      model: 'SomeUnknownModel',
      operation: 'findMany',
      args: { where: { name: 'test' } },
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith({ where: { name: 'test' } });
    expect(result).toBe('result');
  });

  it('$allOperations passes through when model is undefined', () => {
    createTenantPrisma(42);
    const allOps = mockExtends.mock.calls[0][0].query.$allOperations;
    const mockQuery = vi.fn().mockReturnValue('result');

    allOps({
      model: undefined,
      operation: 'findMany',
      args: {},
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith({});
  });

  it('uses different tenantId values for different clients', () => {
    createTenantPrisma(1);
    createTenantPrisma(2);
    expect(mockExtends).toHaveBeenCalledTimes(2);
  });
});
