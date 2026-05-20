import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { filterArrayByRole } from '@/utils/role-filter';
import { logger } from '@/lib/logger';

export const GET = withRole2fa('admin', 'manager')(
  async (request: NextRequest, { user: adminUser }) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(1, Number(searchParams.get('page')) || 1);
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
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
        if (dateTo) {
          // "date" inputs are calendar-day strings; new Date(str) lands at 00:00
          // UTC, which would exclude rows from the chosen day. Bump to the next
          // day and use `lt` so the whole `dateTo` day is included.
          const end = new Date(dateTo);
          end.setUTCDate(end.getUTCDate() + 1);
          (where.createdAt as Record<string, Date>).lt = end;
        }
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
  }
);
