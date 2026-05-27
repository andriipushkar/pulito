import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { runSegment, FIELD_OPS } from '@/services/customer-segments';
import type { SegmentField } from '@/services/customer-segments';
import { maskEmail, maskPhone } from '@/utils/pii';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

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
  // Cap at 20 rules: anything past that is a UI bug or DoS attempt — each
  // rule is evaluated against every retail/wholesale user in memory.
  rules: z
    .array(ruleSchema)
    .min(1, 'Хоча б одне правило обовʼязкове')
    .max(20, 'Забагато правил (макс 20)'),
  limit: z.number().int().min(1).max(10_000).default(100),
  offset: z.number().int().min(0).default(0),
  roles: z.array(z.enum(['client', 'wholesaler'])).optional(),
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    // Heavy scan even with the in-memory cache. 10/min per admin lets the
    // segment-builder iterate quickly while stopping a stuck UI button.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminExport);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${Math.ceil(rl.retryAfter)} с.`, 429);
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const result = await runSegment(parsed.data);

    // Log every segment query so GDPR/compliance reviews can trace WHO
    // browsed customer data with WHICH filters and how many matched. Export
    // already audited; preview was the gap.
    // `data_read` isn't in AuditActionType enum; use `data_update` with
    // an explicit "preview" action marker — same pattern as billing PDF view.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'segment_preview',
      details: {
        action: 'preview',
        rules: parsed.data.rules,
        roles: parsed.data.roles ?? ['client'],
        matchedCount: result.total,
      },
      ipAddress: getClientIp(request),
    });

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
