import { NextRequest, NextResponse } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { maskEmail, maskPhone, maskDigits, maskIp } from '@/utils/pii';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { errorResponse } from '@/utils/api-response';

const EXPORT_LIMIT = 10_000;

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Walk an arbitrary JSON shape, mask any field name that looks like PII
 * (email/phone/edrpou/ipn/iban/ip/password). Limits the GDPR blast radius
 * of an exported audit CSV — staff still see *what* changed, just not the
 * raw values that could be reused to impersonate a customer. */
function sanitizeDetails(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(sanitizeDetails);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (typeof v === 'string') {
      if (lower.includes('email')) out[k] = maskEmail(v);
      else if (lower.includes('phone')) out[k] = maskPhone(v);
      else if (lower === 'password' || lower === 'passwordhash' || lower === 'pass')
        out[k] = '••••';
      else if (lower.includes('edrpou') || lower.includes('ipn') || lower.includes('iban'))
        out[k] = maskDigits(v);
      else if (lower.includes('ip') && !lower.includes('zip')) out[k] = maskIp(v);
      else out[k] = v;
    } else {
      out[k] = sanitizeDetails(v);
    }
  }
  return out;
}

export const GET = withRole2fa(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  const rl = await checkRateLimit(`u${user.id}`, RATE_LIMITS.adminExport);
  if (!rl.allowed) {
    return errorResponse(`Забагато експортів. Спробуйте через ${rl.retryAfter}с`, 429);
  }
  const { searchParams } = new URL(request.url);
  const actionType = searchParams.get('actionType') || undefined;
  const entityType = searchParams.get('entityType') || undefined;
  const userId = searchParams.get('userId') ? Number(searchParams.get('userId')) : undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const ipAddress = searchParams.get('ipAddress') || undefined;

  const normalizedActionType = actionType === 'import' ? 'import_action' : actionType;

  const where: Record<string, unknown> = {};
  if (normalizedActionType) where.actionType = normalizedActionType;
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;
  if (ipAddress) where.ipAddress = { contains: ipAddress };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      // Invalid Date silently turns into NaN — without this check the filter
      // ends up as `gte: Invalid Date` which Prisma rejects with a 500.
      if (Number.isNaN(d.getTime())) {
        // Defer to errorResponse import — keep route shape consistent.
        const { errorResponse } = await import('@/utils/api-response');
        return errorResponse('Невалідна дата dateFrom', 400);
      }
      (where.createdAt as Record<string, Date>).gte = d;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      if (Number.isNaN(end.getTime())) {
        const { errorResponse } = await import('@/utils/api-response');
        return errorResponse('Невалідна дата dateTo', 400);
      }
      end.setUTCDate(end.getUTCDate() + 1);
      (where.createdAt as Record<string, Date>).lt = end;
    }
  }

  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: EXPORT_LIMIT,
  });

  const header = [
    'ID',
    'Дата',
    'Користувач',
    'Email',
    'Тип дії',
    "Об'єкт",
    "ID об'єкта",
    'IP',
    'Деталі',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        r.user?.fullName ?? '',
        maskEmail(r.user?.email) ?? '',
        r.actionType,
        r.entityType ?? '',
        r.entityId ?? '',
        maskIp(r.ipAddress) ?? '',
        r.details ? JSON.stringify(sanitizeDetails(r.details)) : '',
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  const csv = '﻿' + lines.join('\n');
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
