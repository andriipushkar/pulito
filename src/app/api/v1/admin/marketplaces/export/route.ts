import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/**
 * Exports marketplace publication history as XLSX.
 *
 *   GET /api/v1/admin/marketplaces/export?type=history&platform=olx
 *   GET /api/v1/admin/marketplaces/export?type=listings
 *
 * - history:  every publication channel result (any status), ordered by date.
 * - listings: only currently-published listings (one row per active sync).
 */
export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'history') as 'history' | 'listings';
    const platform = searchParams.get('platform') || undefined;

    const where: Record<string, unknown> = {};
    const validPlatforms = ['olx', 'rozetka', 'prom', 'epicentrk'];
    if (platform && validPlatforms.includes(platform)) {
      where.channel = platform;
    } else {
      where.channel = { in: validPlatforms };
    }
    if (type === 'listings') {
      where.status = 'published';
      where.externalId = { not: null };
    }

    const rows = await prisma.publicationChannel.findMany({
      where,
      include: {
        publication: {
          select: {
            title: true,
            product: { select: { code: true, name: true, priceRetail: true, quantity: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const data = rows.map((r) => ({
      Маркетплейс: r.channel,
      Артикул: r.publication.product?.code ?? '',
      Назва: r.publication.product?.name ?? r.publication.title,
      Ціна: r.publication.product?.priceRetail
        ? Number(r.publication.product.priceRetail)
        : '',
      Залишок: r.publication.product?.quantity ?? '',
      Статус: r.status,
      'External ID': r.externalId ?? '',
      Посилання: r.permalink ?? '',
      Помилка: r.errorMessage ?? '',
      'Опубліковано': r.publishedAt ? r.publishedAt.toISOString() : '',
      'Створено': r.createdAt.toISOString(),
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type === 'listings' ? 'Активні лістинги' : 'Історія');
    if (data.length > 0) {
      ws.columns = Object.keys(data[0]).map((k) => ({ header: k, key: k }));
      ws.addRows(data);
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const filename = `marketplace-${type}${platform ? `-${platform}` : ''}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logger.error('[admin/marketplaces/export] GET failed', { error: err });
    return errorResponse('Помилка експорту', 500);
  }
});
