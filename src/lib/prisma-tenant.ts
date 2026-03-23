import { PrismaClient } from '../../generated/prisma';
import { prisma } from '@/lib/prisma';

/**
 * Phase 1 — Tenant-scoped Prisma client (prepared, not enforced yet).
 *
 * This creates a Prisma client extension that automatically injects tenantId
 * into all queries for models that have a tenantId column. Currently no
 * existing models have tenantId, so this is a no-op placeholder.
 *
 * Phased rollout plan:
 *   Phase 1 (current): Schema + tenant resolution + admin UI. No tenantId on
 *     existing tables. This extension is available but not enforced.
 *   Phase 2: Add optional tenantId to Product, Order, Category etc.
 *     Run backfill migration. Enable this extension for scoped queries.
 *   Phase 3: Make tenantId required. Enable RLS (Row Level Security) in
 *     PostgreSQL for defense-in-depth.
 */

// Models that will have tenantId in Phase 2+
const TENANT_SCOPED_MODELS = new Set<string>([
  // 'product', 'order', 'category', etc. — uncomment as tenantId is added
]);

/**
 * Returns a Prisma client that automatically scopes queries by tenantId.
 * Uses $allOperations middleware to inject WHERE tenantId and SET tenantId.
 */
export function createTenantPrisma(tenantId: number): PrismaClient {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        // Only scope models that have tenantId column
        if (!model || !TENANT_SCOPED_MODELS.has(model.toLowerCase())) {
          return query(args);
        }

        // Add tenantId to WHERE clause for read operations
        if (
          operation === 'findUnique' ||
          operation === 'findFirst' ||
          operation === 'findMany' ||
          operation === 'count' ||
          operation === 'aggregate' ||
          operation === 'groupBy'
        ) {
          args.where = { ...args.where, tenantId };
        }

        // Add tenantId to data for write operations
        if (operation === 'create') {
          args.data = { ...args.data, tenantId };
        }

        if (operation === 'createMany') {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d: Record<string, unknown>) => ({
              ...d,
              tenantId,
            }));
          } else {
            args.data = { ...args.data, tenantId };
          }
        }

        // Scope update/delete operations
        if (
          operation === 'update' ||
          operation === 'updateMany' ||
          operation === 'delete' ||
          operation === 'deleteMany'
        ) {
          args.where = { ...args.where, tenantId };
        }

        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}
