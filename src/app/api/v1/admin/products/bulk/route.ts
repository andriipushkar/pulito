import { NextRequest } from 'next/server';
import { Prisma } from '@/../generated/prisma';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import { cacheInvalidate } from '@/services/cache';

const bulkSchema = z.object({
  action: z.enum([
    'activate',
    'deactivate',
    'delete',
    'change_category',
    'export',
    'export_filtered',
  ]),
  productIds: z.array(z.number()).optional(),
  filters: z.record(z.string(), z.string()).optional(),
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { action, productIds, filters } = parsed.data;

    if (action === 'activate' || action === 'deactivate') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isActive: action === 'activate' },
      });
      await cacheInvalidate('products:*');
      return successResponse({ updated: productIds.length });
    }

    if (action === 'delete') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);

      // Try to physically delete each product; if FK constraints block it
      // (e.g. order_items still reference the product), fall back to soft
      // delete so order history isn't broken.
      const softDeletedIds: number[] = [];
      let hardDeleted = 0;
      for (const id of productIds) {
        try {
          await prisma.product.delete({ where: { id } });
          hardDeleted += 1;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
            softDeletedIds.push(id);
          } else {
            throw err;
          }
        }
      }
      if (softDeletedIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: softDeletedIds } },
          data: { isActive: false, deletedAt: new Date() },
        });
      }
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

      return successResponse({
        hardDeleted,
        softDeleted: softDeletedIds.length,
        total: productIds.length,
      });
    }

    if (action === 'change_category') {
      if (!productIds?.length) return errorResponse('Не обрано товарів', 400);
      const categoryId = (body as { categoryId?: number }).categoryId;
      if (!categoryId) return errorResponse('Не вказано категорію', 400);
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { categoryId },
      });
      await cacheInvalidate('products:*');
      return successResponse({ updated: productIds.length });
    }

    if (action === 'export' || action === 'export_filtered') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {};
      if (action === 'export' && productIds?.length) {
        where.id = { in: productIds };
      } else if (action === 'export_filtered' && filters) {
        if (filters.search) {
          where.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { code: { contains: filters.search, mode: 'insensitive' } },
          ];
        }
        if (filters.categoryId) where.categoryId = Number(filters.categoryId);
        if (filters.isActive === 'true') where.isActive = true;
        else if (filters.isActive === 'false') where.isActive = false;
        if (filters.stock === 'out') where.quantity = 0;
        else if (filters.stock === 'low') where.quantity = { gt: 0, lte: 5 };
        else if (filters.stock === 'in') where.quantity = { gt: 5 };
      }

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
      if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
      const fileName = `products_${Date.now()}.xlsx`;
      const filePath = path.join(reportsDir, fileName);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Товари');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      writeFileSync(filePath, buffer);

      return successResponse({ url: `/uploads/reports/${fileName}` });
    }

    return errorResponse('Невідома дія', 400);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
