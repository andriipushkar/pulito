import { prisma } from '@/lib/prisma';
import { cacheInvalidate } from '@/services/cache';
import { Prisma } from '../../generated/prisma';
import type { Tenant, TenantUser, TenantUserRole } from '../../generated/prisma';

// ─────────────────────────────────────
// Tenant CRUD
// ─────────────────────────────────────

interface CreateTenantData {
  name: string;
  slug: string;
  domain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string;
  plan?: 'free' | 'basic' | 'pro' | 'enterprise';
  isActive?: boolean;
  settings?: Record<string, unknown> | null;
}

interface UpdateTenantData {
  name?: string;
  slug?: string;
  domain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string;
  plan?: 'free' | 'basic' | 'pro' | 'enterprise';
  isActive?: boolean;
  settings?: Record<string, unknown> | null;
}

interface TenantFilters {
  plan?: string;
  isActive?: boolean;
  search?: string;
}

export async function createTenant(data: CreateTenantData): Promise<Tenant> {
  const { settings, ...rest } = data;
  return prisma.tenant.create({
    data: {
      ...rest,
      ...(settings === undefined ? {} : { settings: (settings ?? {}) as Prisma.InputJsonValue }),
    },
  });
}

export async function getTenants(filters?: TenantFilters): Promise<Tenant[]> {
  const where: Record<string, unknown> = {};

  if (filters?.plan) {
    where.plan = filters.plan;
  }
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { slug: { contains: filters.search, mode: 'insensitive' } },
      { domain: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true } } },
  });
}

export async function getTenantById(id: number): Promise<Tenant | null> {
  return prisma.tenant.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
}

export async function updateTenant(id: number, data: UpdateTenantData): Promise<Tenant> {
  const { settings, ...rest } = data;
  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      ...rest,
      ...(settings === undefined ? {} : { settings: (settings ?? {}) as Prisma.InputJsonValue }),
    },
  });
  // Invalidate cached tenant lookups
  await cacheInvalidate(`tenant:*`);
  return tenant;
}

export class TenantError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

/**
 * Safe delete: refuses to drop a tenant that still owns users. Forces the
 * platform admin to migrate users first, preventing orphaned records.
 *
 * Pass `force: true` to override (e.g. when a backup already exists or this
 * is a test tenant). Force mode still cascades via Prisma schema relations.
 */
export async function deleteTenant(
  id: number,
  options?: { force?: boolean },
): Promise<{ deleted: boolean; userCount: number }> {
  const userCount = await prisma.tenantUser.count({ where: { tenantId: id } });
  if (userCount > 0 && !options?.force) {
    throw new TenantError(
      `У тенанта залишилось ${userCount} користувачів. Перенесіть їх до іншого тенанта або скористайтесь force=true (потребує бекапу).`,
      409,
    );
  }
  await prisma.tenant.delete({ where: { id } });
  await cacheInvalidate(`tenant:*`);
  return { deleted: true, userCount };
}

// ─────────────────────────────────────
// Tenant Users
// ─────────────────────────────────────

export async function addUserToTenant(
  tenantId: number,
  userId: number,
  role: TenantUserRole = 'member',
): Promise<TenantUser> {
  return prisma.tenantUser.create({
    data: { tenantId, userId, role },
  });
}

export async function removeUserFromTenant(tenantId: number, userId: number): Promise<void> {
  await prisma.tenantUser.delete({
    where: { tenantId_userId: { tenantId, userId } },
  });
}

export async function getTenantUsers(tenantId: number): Promise<TenantUser[]> {
  return prisma.tenantUser.findMany({
    where: { tenantId },
    include: {
      user: { select: { id: true, email: true, fullName: true, role: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}
