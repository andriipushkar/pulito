import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  exportOrders,
  exportClients,
  exportCatalog,
  exportProductsFull,
  exportPriceTemplate,
  exportProductTemplate,
  ExportError,
} from '@/services/export';
import { errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'orders';
    const format = (searchParams.get('format') || 'xlsx') as 'xlsx' | 'csv';

    let result;

    switch (type) {
      case 'orders': {
        const mgrParam = searchParams.get('assignedManagerId');
        result = await exportOrders({
          status: searchParams.get('status') || undefined,
          clientType: searchParams.get('clientType') || undefined,
          dateFrom: searchParams.get('dateFrom') || undefined,
          dateTo: searchParams.get('dateTo') || undefined,
          paymentMethod: searchParams.get('paymentMethod') || undefined,
          paymentStatus: searchParams.get('paymentStatus') || undefined,
          deliveryMethod: searchParams.get('deliveryMethod') || undefined,
          assignedManagerId: mgrParam ? Number(mgrParam) || undefined : undefined,
          search: searchParams.get('search') || undefined,
          format,
        });
        break;
      }
      case 'clients': {
        const blockedParam = searchParams.get('isBlocked');
        result = await exportClients({
          role: searchParams.get('role') || undefined,
          wholesaleStatus: searchParams.get('wholesaleStatus') || undefined,
          wholesaleGroup: searchParams.get('wholesaleGroup') || undefined,
          isBlocked:
            blockedParam === 'true' ? true : blockedParam === 'false' ? false : undefined,
          dateFrom: searchParams.get('dateFrom') || undefined,
          dateTo: searchParams.get('dateTo') || undefined,
          search: searchParams.get('search') || undefined,
          format,
        });
        break;
      }
      case 'catalog':
        result = await exportCatalog({ format });
        break;
      case 'products_full': {
        const idsParam = searchParams.get('ids');
        const ids = idsParam
          ? idsParam
              .split(',')
              .map(Number)
              .filter((n) => !isNaN(n))
          : undefined;
        result = await exportProductsFull({ ids, format });
        break;
      }
      case 'price_template':
        result = await exportPriceTemplate({ format });
        break;
      case 'product_template':
        result = await exportProductTemplate({ format });
        break;
      default:
        return errorResponse('Невідомий тип експорту', 400);
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ExportError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/export] GET failed', { error });
    return errorResponse('Помилка експорту', 500);
  }
});
