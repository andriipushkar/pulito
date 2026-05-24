import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { withRole2fa } from '@/middleware/auth';
import { errorResponse } from '@/utils/api-response';
import { runSegment, FIELD_OPS } from '@/services/customer-segments';
import type { SegmentField } from '@/services/customer-segments';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

// CSV/XLSX export of a segment with the FULL contact list. Unlike the preview
// endpoint (which masks email/phone for the segment-builder UI), export
// returns the raw values — that's the whole point: it feeds a manager's
// outreach workflow. Gate behind 2FA + audit so every export is traceable.
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
  roles: z.array(z.enum(['client', 'wholesaler'])).optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIME = 'text/csv';

export const POST = withRole2fa(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`u${user.id}`, RATE_LIMITS.adminExport);
    if (!rl.allowed) {
      return errorResponse(`Забагато експортів. Спробуйте через ${rl.retryAfter}с`, 429);
    }
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // limit=10000 caps a single export to keep the round-trip bounded;
    // typical campaign segments are <2k.
    const result = await runSegment({ ...parsed.data, limit: 10_000, offset: 0 });

    const rows = result.users.map((u) => ({
      ID: u.id,
      "Ім'я": u.fullName,
      Email: u.email,
      Телефон: u.phone ?? '',
      Роль: u.role,
      'К-ть замовлень': u.orderCount,
      'Сума витрат': u.totalSpent,
      'Днів з останнього замовлення': u.lastOrderDays ?? '',
      Місто: u.city ?? '',
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Сегмент');
    if (rows.length > 0) {
      ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 20 }));
      ws.addRows(rows);
    }

    const buffer =
      parsed.data.format === 'csv'
        ? Buffer.from(await wb.csv.writeBuffer())
        : Buffer.from(await wb.xlsx.writeBuffer());

    const ts = new Date().toISOString().slice(0, 10);
    const ext = parsed.data.format === 'csv' ? 'csv' : 'xlsx';
    const filename = `segment_${ts}.${ext}`;

    await logAudit({
      userId: user.id,
      actionType: 'gdpr_export',
      entityType: 'segment',
      details: { format: parsed.data.format, rowCount: rows.length },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': parsed.data.format === 'csv' ? CSV_MIME : XLSX_MIME,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('[admin/segments/export] POST failed', { error });
    return errorResponse('Помилка експорту сегмента', 500);
  }
});
