import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { runSegment, FIELD_OPS } from '@/services/customer-segments';
import type { SegmentField } from '@/services/customer-segments';
import { maskEmail, maskPhone } from '@/utils/pii';

const ruleSchema = z
  .object({
    field: z.enum(['orderCount', 'totalSpent', 'lastOrderDays', 'city']),
    op: z.enum(['gte', 'lte', 'eq', 'contains']),
    value: z.union([z.string(), z.number()]),
  })
  .refine((r) => FIELD_OPS[r.field as SegmentField].includes(r.op), {
    message: 'Оператор не підтримується цим полем',
  });

const bodySchema = z.object({
  rules: z.array(ruleSchema).min(1, 'Хоча б одне правило обовʼязкове'),
  limit: z.number().int().min(1).max(10_000).default(100),
  offset: z.number().int().min(0).default(0),
  roles: z.array(z.enum(['client', 'wholesaler'])).optional(),
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const result = await runSegment(parsed.data);
    // Preview is a sanity-check screen, not an export — mask PII so the
    // segment-builder UI can't double as a customer-list exfil tool.
    const masked = {
      ...result,
      users: result.users.map((row) => ({
        ...row,
        email: maskEmail(row.email) ?? row.email,
        phone: row.phone ? (maskPhone(row.phone) ?? row.phone) : row.phone,
      })),
    };
    return successResponse(masked);
  } catch (error) {
    console.error('[Segments preview]', error);
    return errorResponse('Помилка при обчисленні сегмента', 500);
  }
});
