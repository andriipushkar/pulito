import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { runReport } from '@/services/report-builder';
import type { Dimension, Metric } from '@/services/report-builder';

const ALLOWED_DIMENSIONS = new Set<Dimension>([
  'status',
  'clientType',
  'deliveryMethod',
  'paymentMethod',
  'monthYear',
]);
const ALLOWED_METRICS = new Set<Metric>(['orderCount', 'totalRevenue', 'avgCheck']);

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      dimension?: unknown;
      metrics?: unknown;
      dateFrom?: unknown;
      dateTo?: unknown;
    };
    const dimension = typeof body.dimension === 'string' ? body.dimension : '';
    if (!ALLOWED_DIMENSIONS.has(dimension as Dimension)) {
      return errorResponse('Невалідна dimension', 400);
    }
    const metrics = Array.isArray(body.metrics)
      ? body.metrics.filter((m): m is Metric => typeof m === 'string' && ALLOWED_METRICS.has(m as Metric))
      : [];
    if (metrics.length === 0) return errorResponse('Оберіть хоча б одну метрику', 400);

    const rows = await runReport({
      dimension: dimension as Dimension,
      metrics,
      dateFrom: typeof body.dateFrom === 'string' ? body.dateFrom : undefined,
      dateTo: typeof body.dateTo === 'string' ? body.dateTo : undefined,
    });
    return successResponse({ rows });
  } catch (error) {
    console.error('[Report builder]', error);
    return errorResponse('Помилка генерації звіту', 500);
  }
});
