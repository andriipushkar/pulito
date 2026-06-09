import { NextRequest, NextResponse } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { maskEmail, maskPhone, maskDigits, maskIp } from '@/utils/pii';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { errorResponse } from '@/utils/api-response';
import { kyivMidnightUtc, kyivNextDayUtc } from '@/utils/format';

// Per-export row cap. Previously 10k = ~10MB PII dump per request. Combined
// with adminExport rate-limit (10/min) that's 100MB/min/admin — enough for
// a stolen session to exfiltrate the full audit log in minutes. Lowered to
// 2000 (≈ 2MB) which still covers normal "give me last 30 days" use-cases
// and forces multi-request iteration for full-log scrape, capped naturally
// by the rate-limit.
const EXPORT_LIMIT = 2_000;

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // CSV-injection guard: cells starting with =, +, -, @, tab or CR are
  // interpreted as formulas by Excel/Sheets when the file is opened. Prefix
  // with a single-quote which is the documented neutralisation.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
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
      // Invalid Date silently turns into NaN — without this check the filter
      // ends up as `gte: Invalid Date` which Prisma rejects with a 500.
      if (Number.isNaN(new Date(dateFrom).getTime())) {
        return errorResponse('Невалідна дата dateFrom', 400);
      }
      // Calendar-day string → Kyiv 00:00 (DST-aware), not UTC midnight.
      (where.createdAt as Record<string, Date>).gte = kyivMidnightUtc(dateFrom);
    }
    if (dateTo) {
      if (Number.isNaN(new Date(dateTo).getTime())) {
        return errorResponse('Невалідна дата dateTo', 400);
      }
      // `lt` Kyiv-start of next day so the whole dateTo Kyiv day is included.
      (where.createdAt as Record<string, Date>).lt = kyivNextDayUtc(dateTo);
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
