import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateReport } from '@/services/report-generator';
import { z } from 'zod';

const generateSchema = z.object({
  templateKey: z.enum([
    'sales_summary',
    'products_stock',
    'orders_by_status',
    'clients_activity',
    'wholesale_report',
    'delivery_report',
    'financial_report',
    'returns_cancellations',
    'wholesale_groups',
    'product_leaders',
    'manager_activity',
    'acquisition_channels',
    'summary_report',
    'custom',
  ]),
  format: z.enum(['xlsx', 'csv', 'pdf']),
  params: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: z.string().optional(),
    entity: z.string().optional(),
    fields: z.array(z.string()).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
  }).optional().default({}),
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { templateKey, format, params } = parsed.data;
    const result = await generateReport(templateKey, format, params);

    return successResponse(result);
  } catch {
    return errorResponse('Помилка генерації звіту', 500);
  }
});
