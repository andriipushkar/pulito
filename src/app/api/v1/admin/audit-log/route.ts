import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { filterArrayByRole } from '@/utils/role-filter';

export const GET = withRole('admin', 'manager')(
  async (request: NextRequest, { user: adminUser }) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(1, Number(searchParams.get('page')) || 1);
      const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
      const actionType = searchParams.get('actionType') || undefined;
      const entityType = searchParams.get('entityType') || undefined;
      const userId = searchParams.get('userId') ? Number(searchParams.get('userId')) : undefined;
      const dateFrom = searchParams.get('dateFrom') || undefined;
      const dateTo = searchParams.get('dateTo') || undefined;
      const ipAddress = searchParams.get('ipAddress') || undefined;

      const where: Record<string, unknown> = {};
      if (actionType) where.actionType = actionType;
      if (entityType) where.entityType = entityType;
      if (userId) where.userId = userId;
      if (ipAddress) where.ipAddress = { contains: ipAddress };
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
        if (dateTo) (where.createdAt as Record<string, Date>).lte = new Date(dateTo);
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
    } catch {
      return errorResponse('Помилка завантаження журналу', 500);
    }
  }
);
