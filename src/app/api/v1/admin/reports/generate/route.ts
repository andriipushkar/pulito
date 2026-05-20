import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { generateReport } from '@/services/report-generator';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// Allowed entity types for the `custom` template — anything else is rejected
// before reaching the SQL layer.
const ALLOWED_ENTITIES = ['orders', 'products', 'users', 'wholesalers'] as const;
const ALLOWED_FIELDS: Record<(typeof ALLOWED_ENTITIES)[number], readonly string[]> = {
  orders: [
    'orderNumber', 'status', 'paymentStatus', 'totalAmount', 'createdAt',
    'contactName', 'contactPhone', 'contactEmail', 'deliveryMethod', 'paymentMethod',
    'companyName', 'edrpou', 'deliveryCity', 'itemsCount',
  ],
  products: [
    'code', 'name', 'priceRetail', 'priceWholesale', 'priceWholesale2',
    'priceWholesale3', 'quantity', 'isActive', 'isPromo', 'ordersCount', 'categoryName',
  ],
  users: [
    'id', 'fullName', 'email', 'phone', 'role', 'createdAt', 'wholesaleStatus',
    'wholesaleGroup', 'totalSpent', 'orderCount',
  ],
  wholesalers: [
    'id', 'fullName', 'email', 'phone', 'companyName', 'edrpou',
    'wholesaleGroup', 'totalSpent', 'orderCount', 'createdAt',
  ],
};

function looksLikeIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) && !Number.isNaN(Date.parse(v));
}

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
  params: z
    .object({
      dateFrom: z.string().optional().refine((v) => !v || looksLikeIsoDate(v), 'Невалідна дата dateFrom'),
      dateTo: z.string().optional().refine((v) => !v || looksLikeIsoDate(v), 'Невалідна дата dateTo'),
      status: z.string().max(50).optional(),
      entity: z.enum(ALLOWED_ENTITIES).optional(),
      fields: z.array(z.string().max(50)).max(50).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    })
    .optional()
    .default({}),
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { templateKey, format, params } = parsed.data;

    // Whitelist-validate custom report fields against the allow-list for the
    // chosen entity — otherwise a caller could exfiltrate arbitrary columns.
    if (templateKey === 'custom') {
      if (!params.entity) {
        return errorResponse('Для custom звіту обов’язковий entity', 400);
      }
      const allowed = ALLOWED_FIELDS[params.entity];
      const fields = params.fields ?? [];
      const bad = fields.filter((f) => !allowed.includes(f));
      if (bad.length > 0) {
        return errorResponse(`Заборонені поля: ${bad.join(', ')}`, 400);
      }
    }

    const result = await generateReport(templateKey, format, params);

    await logAudit({
      userId: user.id,
      actionType: 'gdpr_export',
      entityType: 'report',
      details: { templateKey, format, entity: params.entity, fieldsCount: params.fields?.length ?? 0 },
    });

    return successResponse(result);
  } catch (err) {
    logger.error('[admin/reports/generate] POST failed', { error: err });
    return errorResponse('Помилка генерації звіту', 500);
  }
});
