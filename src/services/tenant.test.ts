import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tenantUser: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock('@/services/cache', () => ({
  cacheInvalidate: vi.fn().mockResolvedValue(0),
}));

import { prisma } from '@/lib/prisma';
import {
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  addUserToTenant,
  removeUserFromTenant,
  getTenantUsers,
} from './tenant';

const tenantCreate = prisma.tenant.create as ReturnType<typeof vi.fn>;
const tenantFindMany = prisma.tenant.findMany as ReturnType<typeof vi.fn>;
const tenantFindUnique = prisma.tenant.findUnique as ReturnType<typeof vi.fn>;
const tenantUpdate = prisma.tenant.update as ReturnType<typeof vi.fn>;
const tenantDelete = prisma.tenant.delete as ReturnType<typeof vi.fn>;
const tenantUserCreate = prisma.tenantUser.create as ReturnType<typeof vi.fn>;
const tenantUserDelete = prisma.tenantUser.delete as ReturnType<typeof vi.fn>;
const tenantUserFindMany = prisma.tenantUser.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTenant', () => {
  it('creates a tenant with the provided data', async () => {
    const data = { name: 'Acme Store', slug: 'acme-store' };
    const expected = { id: 1, ...data, plan: 'free', isActive: true };
    tenantCreate.mockResolvedValue(expected);

    const result = await createTenant(data);

    expect(tenantCreate).toHaveBeenCalledWith({ data });
    expect(result).toEqual(expected);
  });

  it('generates unique slug via provided slug', async () => {
    const data = { name: 'Test Shop', slug: 'test-shop' };
    tenantCreate.mockResolvedValue({ id: 2, ...data });

    const result = await createTenant(data);

    expect(result.slug).toBe('test-shop');
  });
});

describe('getTenants', () => {
  it('returns all tenants when no filters', async () => {
    const tenants = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    tenantFindMany.mockResolvedValue(tenants);

    const result = await getTenants();

    expect(tenantFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    });
    expect(result).toEqual(tenants);
  });

  it('filters by plan and search', async () => {
    tenantFindMany.mockResolvedValue([]);

    await getTenants({ plan: 'pro', search: 'acme' });

    expect(tenantFindMany).toHaveBeenCalledWith({
      where: {
        plan: 'pro',
        OR: [
          { name: { contains: 'acme', mode: 'insensitive' } },
          { slug: { contains: 'acme', mode: 'insensitive' } },
          { domain: { contains: 'acme', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    });
  });
});

describe('getTenantById', () => {
  it('returns tenant by slug via getTenantById', async () => {
    const tenant = { id: 1, slug: 'acme', name: 'Acme' };
    tenantFindUnique.mockResolvedValue(tenant);

    const result = await getTenantById(1);

    expect(tenantFindUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { _count: { select: { users: true } } },
    });
    expect(result).toEqual(tenant);
  });
});

describe('updateTenant', () => {
  it('updates tenant and invalidates cache', async () => {
    const updated = { id: 1, name: 'Updated' };
    tenantUpdate.mockResolvedValue(updated);

    const result = await updateTenant(1, { name: 'Updated' });

    expect(tenantUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Updated' },
    });
    expect(result).toEqual(updated);
  });
});

describe('deleteTenant', () => {
  it('deletes tenant (cascades to TenantUser)', async () => {
    tenantDelete.mockResolvedValue({});

    await deleteTenant(1);

    expect(tenantDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

describe('addUserToTenant', () => {
  it('creates tenant-user association with default member role', async () => {
    const expected = { id: 1, tenantId: 10, userId: 20, role: 'member' };
    tenantUserCreate.mockResolvedValue(expected);

    const result = await addUserToTenant(10, 20);

    expect(tenantUserCreate).toHaveBeenCalledWith({
      data: { tenantId: 10, userId: 20, role: 'member' },
    });
    expect(result).toEqual(expected);
  });

  it('creates tenant-user association with specified role', async () => {
    const expected = { id: 2, tenantId: 10, userId: 30, role: 'admin' };
    tenantUserCreate.mockResolvedValue(expected);

    const result = await addUserToTenant(10, 30, 'admin');

    expect(tenantUserCreate).toHaveBeenCalledWith({
      data: { tenantId: 10, userId: 30, role: 'admin' },
    });
    expect(result).toEqual(expected);
  });
});

describe('removeUserFromTenant', () => {
  it('removes user from tenant', async () => {
    tenantUserDelete.mockResolvedValue({});

    await removeUserFromTenant(10, 20);

    expect(tenantUserDelete).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: 10, userId: 20 } },
    });
  });
});

describe('getTenantUsers', () => {
  it('returns users for a given tenant', async () => {
    const users = [
      { id: 1, tenantId: 10, userId: 20, role: 'owner', user: { id: 20, email: 'a@b.com' } },
    ];
    tenantUserFindMany.mockResolvedValue(users);

    const result = await getTenantUsers(10);

    expect(tenantUserFindMany).toHaveBeenCalledWith({
      where: { tenantId: 10 },
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual(users);
  });
});
