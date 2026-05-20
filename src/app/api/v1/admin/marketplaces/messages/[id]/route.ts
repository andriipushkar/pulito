import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

interface PatchBody {
  assigneeId?: number | null;
  isRead?: boolean;
}

export const PATCH = withRole('admin', 'manager')(
  async (req: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const mid = Number(id);
      if (!Number.isFinite(mid)) return errorResponse('Невалідний ID', 400);

      const body = (await req.json().catch(() => ({}))) as PatchBody;

      const data: Record<string, unknown> = {};
      if (body.assigneeId === null) {
        data.assignedTo = null;
      } else if (typeof body.assigneeId === 'number') {
        const user = await prisma.user.findUnique({
          where: { id: body.assigneeId },
          select: { id: true, role: true },
        });
        if (!user) return errorResponse('Користувача не знайдено', 404);
        if (user.role !== 'admin' && user.role !== 'manager') {
          return errorResponse('Призначити можна лише адміна або менеджера', 400);
        }
        data.assignedTo = body.assigneeId;
      }
      if (typeof body.isRead === 'boolean') data.isRead = body.isRead;

      if (Object.keys(data).length === 0) return errorResponse('Немає полів для оновлення', 400);

      const updated = await prisma.marketplaceMessage.update({
        where: { id: mid },
        data,
        include: { assignee: { select: { id: true, fullName: true } } },
      });

      return successResponse({
        id: String(updated.id),
        assignee: updated.assignee,
        isRead: updated.isRead,
      });
    } catch (err) {
      logger.error('[admin/marketplaces/messages/[id]] PATCH failed', { error: err });
      return errorResponse('Помилка оновлення', 500);
    }
  },
);
