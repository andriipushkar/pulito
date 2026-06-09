import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { filterArrayByRole } from '@/utils/role-filter';
import { logger } from '@/lib/logger';
import { kyivMidnightUtc, kyivNextDayUtc } from '@/utils/format';

export const GET = withRole2fa(
  'admin',
  'manager',
)(async (request: NextRequest, { user: adminUser }) => {
  try {
    const { searchParams } = new URL(request.url);
    // Cap page at 10k so an attacker can't request page=1M and force the
    // DB to skip-scan tens of millions of audit rows. Realistic admin
    // use-cases never need page>10000 — that's 200k entries deep with
    // default limit=20. Use date filter for older data instead.
    const page = Math.min(10_000, Math.max(1, Number(searchParams.get('page')) || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const actionType = searchParams.get('actionType') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const entityIdRaw = searchParams.get('entityId');
    const entityId = entityIdRaw ? Number(entityIdRaw) : undefined;
    const userId = searchParams.get('userId') ? Number(searchParams.get('userId')) : undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const ipAddress = searchParams.get('ipAddress') || undefined;

    // UI ships the public-facing label "import" but the Prisma enum value is
    // `import_action` (DB column carries the @map'd "import"). Translate here
    // so the filter actually matches rows.
    const normalizedActionType = actionType === 'import' ? 'import_action' : actionType;

    const where: Record<string, unknown> = {};
    if (normalizedActionType) where.actionType = normalizedActionType;
    if (entityType) where.entityType = entityType;
    if (entityId && Number.isFinite(entityId)) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (ipAddress) where.ipAddress = { contains: ipAddress };
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) {
        if (Number.isNaN(new Date(dateFrom).getTime())) {
          return errorResponse('Невалідне значення dateFrom', 400);
        }
        // Calendar-day string → Kyiv 00:00 (DST-aware), not UTC midnight.
        range.gte = kyivMidnightUtc(dateFrom);
      }
      if (dateTo) {
        if (Number.isNaN(new Date(dateTo).getTime())) {
          return errorResponse('Невалідне значення dateTo', 400);
        }
        // `lt` Kyiv-start of next day so the whole dateTo Kyiv day is included.
        range.lt = kyivNextDayUtc(dateTo);
      }
      where.createdAt = range;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const role = adminUser!.role as 'admin' | 'manager';
    const filtered = filterArrayByRole(logs as Record<string, unknown>[], role);
    return paginatedResponse(filtered, total, page, limit);
  } catch (err) {
    logger.error('[admin/audit-log] GET failed', { error: err });
    return errorResponse('Помилка завантаження журналу', 500);
  }
});
