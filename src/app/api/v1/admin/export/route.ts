import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  exportOrders,
  exportClients,
  exportCatalog,
  exportProductsFull,
  ExportError,
} from '@/services/export';
import { errorResponse } from '@/utils/api-response';

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
      case 'orders':
        result = await exportOrders({
          status: searchParams.get('status') || undefined,
          clientType: searchParams.get('clientType') || undefined,
          dateFrom: searchParams.get('dateFrom') || undefined,
          dateTo: searchParams.get('dateTo') || undefined,
          format,
        });
        break;
      case 'clients':
        result = await exportClients({
          role: searchParams.get('role') || undefined,
          format,
        });
        break;
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
    return errorResponse('Помилка експорту', 500);
  }
});
