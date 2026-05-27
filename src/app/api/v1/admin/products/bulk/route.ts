import { NextRequest } from 'next/server';
import { Prisma } from '@/../generated/prisma';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { env } from '@/config/env';
import { cacheInvalidate } from '@/services/cache';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

const BULK_IDS_LIMIT = 5000;

const bulkSchema = z.object({
  action: z.enum([
    'activate',
    'deactivate',
    'delete',
    'change_category',
    'change_brand',
    'change_price',
    'export',
    'export_filtered',
  ]),
  productIds: z.array(z.number().int().positive()).max(BULK_IDS_LIMIT).optional(),
  filters: z.record(z.string(), z.string()).optional(),
  // For change_category / change_brand:
  categoryId: z.number().int().positive().optional(),
  brandId: z.number().int().nullable().optional(),
  // For change_price action:
  priceTarget: z.enum(['retail', 'wholesale', 'wholesale2', 'wholesale3', 'all']).optional(),
  priceMode: z.enum(['percent', 'fixed', 'add', 'round']).optional(),
  priceValue: z.number().optional(),
  priceRound: z.number().int().min(1).optional(),
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { action, productIds, filters } = parsed.data;
    const ipAddress = getClientIp(request);

    if (action === 'activate' || action === 'deactivate') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isActive: action === 'activate' },
      });
      await cacheInvalidate('products:*');
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'product_bulk',
        details: { action, count: productIds.length, productIds },
        ipAddress,
      });
      return successResponse({ updated: productIds.length });
    }

    if (action === 'delete') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);

      // Pre-classify ids: those with FK references go to soft-delete, the rest
      // can be hard-deleted. Doing this in a single transaction makes the
      // operation all-or-nothing — previously a mid-loop throw left half the
      // batch deleted and half untouched.
      const referencedIds = new Set<number>();
      const referencingCounts = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _count: { productId: true },
      });
      for (const r of referencingCounts) {
        if (r.productId !== null) referencedIds.add(r.productId);
      }

      const hardIds = productIds.filter((id) => !referencedIds.has(id));
      const softDeletedIds = productIds.filter((id) => referencedIds.has(id));

      await prisma.$transaction(async (tx) => {
        if (hardIds.length > 0) {
          await tx.product.deleteMany({ where: { id: { in: hardIds } } });
        }
        if (softDeletedIds.length > 0) {
          await tx.product.updateMany({
            where: { id: { in: softDeletedIds } },
            data: { isActive: false, deletedAt: new Date() },
          });
        }
      });
      const hardDeleted = hardIds.length;
      await cacheInvalidate('products:*');

      // Sync Typesense (best-effort, fire-and-forget).
      import('@/services/typesense')
        .then(async (ts) => {
          await Promise.all([
            ...productIds
              .filter((id) => !softDeletedIds.includes(id))
              .map((id) => ts.removeProductFromIndex(id)),
            ...softDeletedIds.map((id) => ts.indexProduct(id)),
          ]);
        })
        .catch(() => {});

      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'product_bulk',
        details: {
          action: 'delete',
          count: productIds.length,
          hardDeleted,
          softDeleted: softDeletedIds.length,
          productIds,
        },
        ipAddress,
      });
      return successResponse({
        hardDeleted,
        softDeleted: softDeletedIds.length,
        total: productIds.length,
      });
    }

    if (action === 'change_category') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);
      const categoryId = parsed.data.categoryId;
      if (!categoryId) return errorResponse('Не вказано категорію', 400);
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { categoryId },
      });
      await cacheInvalidate('products:*');
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'product_bulk',
        details: { action: 'change_category', categoryId, count: productIds.length, productIds },
        ipAddress,
      });
      return successResponse({ updated: productIds.length });
    }

    if (action === 'change_price') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);
      const { priceTarget, priceMode, priceValue, priceRound } = parsed.data;
      if (!priceTarget) return errorResponse('Не вказано тип ціни', 400);
      if (!priceMode) return errorResponse('Не вказано режим оновлення', 400);
      if (priceMode !== 'round' && priceValue === undefined) {
        return errorResponse('Не вказано значення', 400);
      }
      if (priceMode === 'round' && !priceRound) {
        return errorResponse('Не вказано крок округлення', 400);
      }

      const targets: ('priceRetail' | 'priceWholesale' | 'priceWholesale2' | 'priceWholesale3')[] =
        priceTarget === 'all'
          ? ['priceRetail', 'priceWholesale', 'priceWholesale2', 'priceWholesale3']
          : priceTarget === 'retail'
            ? ['priceRetail']
            : priceTarget === 'wholesale'
              ? ['priceWholesale']
              : priceTarget === 'wholesale2'
                ? ['priceWholesale2']
                : ['priceWholesale3'];

      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          priceRetail: true,
          priceWholesale: true,
          priceWholesale2: true,
          priceWholesale3: true,
        },
      });

      type PriceUpdate = {
        id: number;
        data: Record<string, number>;
        before: Record<string, number | null>;
        after: Record<string, number>;
      };

      const updates: PriceUpdate[] = [];
      let skippedCount = 0;
      for (const p of products) {
        const updateData: Record<string, number> = {};
        const before: Record<string, number | null> = {};
        const after: Record<string, number> = {};
        let changed = false;
        for (const field of targets) {
          const current = p[field] !== null ? Number(p[field]) : null;
          if (current === null) continue;
          let next = current;
          if (priceMode === 'percent') {
            next = current * (1 + (priceValue ?? 0) / 100);
          } else if (priceMode === 'add') {
            next = current + (priceValue ?? 0);
          } else if (priceMode === 'fixed') {
            next = priceValue ?? 0;
          } else if (priceMode === 'round' && priceRound) {
            next = Math.round(current / priceRound) * priceRound;
          }
          // Round to 2 decimals; never negative
          next = Math.max(0, Math.round(next * 100) / 100);
          if (next !== current) {
            updateData[field] = next;
            before[field] = current;
            after[field] = next;
            changed = true;
          }
        }
        if (changed) {
          updates.push({ id: p.id, data: updateData, before, after });
        } else {
          skippedCount++;
        }
      }

      // Atomic: all-or-nothing. Partial price changes are worse than no change.
      //
      // For `fixed` mode each id gets the same value, so we can batch with a
      // single updateMany per target field. For `percent`/`add`/`round` modes
      // each id gets a different value, so we group ids by their resulting
      // price payload — products that happen to land on the same new price
      // share an UPDATE round-trip. Worst case (all unique prices) degrades
      // to one update per product as before; best case (most products share
      // a SKU price tier) is ~10× faster.
      await prisma.$transaction(async (tx) => {
        const groups = new Map<string, { ids: number[]; data: Record<string, number> }>();
        for (const u of updates) {
          const key = JSON.stringify(u.data);
          const existing = groups.get(key);
          if (existing) existing.ids.push(u.id);
          else groups.set(key, { ids: [u.id], data: u.data });
        }
        for (const { ids, data } of groups.values()) {
          await tx.product.updateMany({ where: { id: { in: ids } }, data });
        }
      });
      const updatedCount = updates.length;
      const changes = updates.map((u) => ({ id: u.id, before: u.before, after: u.after }));
      await cacheInvalidate('products:*');
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'product_bulk',
        details: {
          action: 'change_price',
          priceTarget,
          priceMode,
          priceValue,
          priceRound,
          updated: updatedCount,
          skipped: skippedCount,
          changes: changes.slice(0, 200),
        },
        ipAddress,
      });
      return successResponse({ updated: updatedCount, skipped: skippedCount });
    }

    if (action === 'change_brand') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);
      // brandId === 0 / null means "clear" — let the admin un-set a manufacturer.
      const rawBrandId = parsed.data.brandId;
      const brandId =
        rawBrandId === null || rawBrandId === 0 || rawBrandId === undefined ? null : rawBrandId;
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { brandId },
      });
      await cacheInvalidate('products:*');
      await logAudit({
        userId: user.id,
        actionType: 'rule_change',
        entityType: 'product_bulk',
        details: { action: 'change_brand', brandId, count: productIds.length, productIds },
        ipAddress,
      });
      return successResponse({ updated: productIds.length });
    }

    if (action === 'export' || action === 'export_filtered') {
      const where: Prisma.ProductWhereInput = {};
      if (action === 'export' && productIds?.length) {
        where.id = { in: productIds };
      } else if (action === 'export_filtered' && filters) {
        // Mirror every filter the products-list page renders, so the XLSX the
        // admin downloads matches what's on screen. Earlier this branch only
        // applied search/category/isActive/stock and silently dropped brandId
        // and missingBarcode, producing exports that didn't match the list.
        if (filters.search) {
          where.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { code: { contains: filters.search, mode: 'insensitive' } },
          ];
        }
        if (filters.categoryId) where.categoryId = Number(filters.categoryId);
        if (filters.brandId) where.brandId = Number(filters.brandId);
        if (filters.isActive === 'true') where.isActive = true;
        else if (filters.isActive === 'false') where.isActive = false;
        if (filters.stock === 'out') where.quantity = 0;
        else if (filters.stock === 'low') where.quantity = { gt: 0, lte: 5 };
        else if (filters.stock === 'in') where.quantity = { gt: 5 };
        if (filters.missingBarcode === 'true') where.barcode = null;
      }

      const EXPORT_HARD_LIMIT = 50_000;
      const products = await prisma.product.findMany({
        where,
        select: {
          code: true,
          name: true,
          priceRetail: true,
          priceWholesale: true,
          priceWholesale2: true,
          priceWholesale3: true,
          quantity: true,
          isActive: true,
          isPromo: true,
          ordersCount: true,
          category: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        take: EXPORT_HARD_LIMIT,
      });

      const rows = products.map((p) => ({
        Код: p.code,
        Назва: p.name,
        Категорія: p.category?.name || '',
        'Роздрібна ціна': Number(Number(p.priceRetail).toFixed(2)),
        'Ціна: Дрібний опт': p.priceWholesale ? Number(Number(p.priceWholesale).toFixed(2)) : '',
        'Ціна: Середній опт': p.priceWholesale2 ? Number(Number(p.priceWholesale2).toFixed(2)) : '',
        'Ціна: Великий опт': p.priceWholesale3 ? Number(Number(p.priceWholesale3).toFixed(2)) : '',
        Залишок: p.quantity,
        Продажі: p.ordersCount,
        Активний: p.isActive ? 'Так' : 'Ні',
        Акція: p.isPromo ? 'Так' : 'Ні',
      }));

      const reportsDir = path.join(env.UPLOAD_DIR, 'reports');
      await mkdir(reportsDir, { recursive: true });
      const fileName = `products_${Date.now()}.xlsx`;
      const filePath = path.join(reportsDir, fileName);

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Товари');
      if (rows.length > 0) {
        ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k }));
        ws.addRows(rows);
      }
      const buffer = await wb.xlsx.writeBuffer();
      await writeFile(filePath, Buffer.from(buffer));

      return successResponse({ url: `/uploads/reports/${fileName}` });
    }

    return errorResponse('Невідома дія', 400);
  } catch (err) {
    logger.error('[admin/products/bulk] failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
