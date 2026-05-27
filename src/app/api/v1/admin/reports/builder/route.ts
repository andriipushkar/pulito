import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { runReport } from '@/services/report-builder';
import type { Dimension, Metric } from '@/services/report-builder';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const DIMENSIONS = [
  'status',
  'clientType',
  'deliveryMethod',
  'paymentMethod',
  'monthYear',
] as const;
const METRICS = ['orderCount', 'totalRevenue', 'avgCheck'] as const;

const builderSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  metrics: z.array(z.enum(METRICS)).min(1, 'Оберіть хоча б одну метрику').max(METRICS.length),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = builderSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const { dimension, metrics, dateFrom, dateTo } = parsed.data;

    const rows = await runReport({
      dimension: dimension as Dimension,
      metrics: metrics as Metric[],
      dateFrom,
      dateTo,
    });

    // Builder result is a small aggregate, but it reads from order tables —
    // GDPR-relevant if combined to deanonymise customers. Audit who ran what.
    await logAudit({
      userId: user.id,
      actionType: 'gdpr_export',
      entityType: 'report_builder',
      details: {
        dimension,
        metrics,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        rowCount: rows.length,
      },
      ipAddress: getClientIp(request),
    });

    return successResponse({ rows });
  } catch (error) {
    console.error('[Report builder]', error);
    return errorResponse('Помилка генерації звіту', 500);
  }
});
