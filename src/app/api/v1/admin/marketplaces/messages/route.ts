import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const sp = request.nextUrl.searchParams;
      const channel = sp.get('channel');
      const unreadOnly = sp.get('unread') === '1';
      const unansweredOnly = sp.get('unanswered') === '1';
      const assignedTo = sp.get('assignedTo');
      const limit = Math.min(Math.max(Number(sp.get('limit')) || 100, 1), 500);
      const offset = Math.max(Number(sp.get('offset')) || 0, 0);

      const where: Record<string, unknown> = {};
      if (channel) where.platform = channel;
      if (unreadOnly) where.isRead = false;
      if (unansweredOnly) where.firstRespondedAt = null;
      if (assignedTo === 'unassigned') {
        where.assignedTo = null;
      } else if (assignedTo && /^\d+$/.test(assignedTo)) {
        where.assignedTo = Number(assignedTo);
      }

      const [rows, total, unreadCount] = await Promise.all([
        prisma.marketplaceMessage.findMany({
          where,
          orderBy: { receivedAt: 'desc' },
          skip: offset,
          take: limit,
          include: { assignee: { select: { id: true, fullName: true } } },
        }),
        prisma.marketplaceMessage.count({ where }),
        prisma.marketplaceMessage.count({ where: { ...where, isRead: false } }),
      ]);

      const normalized = rows.map((r) => ({
        id: String(r.id),
        threadId: r.externalThreadId,
        marketplace: r.platform,
        buyerName: r.buyerName,
        text: r.text,
        listingTitle: r.listingTitle ?? undefined,
        listingId: r.externalListingId ?? '',
        createdAt: r.receivedAt.toISOString(),
        isRead: r.isRead,
        firstRespondedAt: r.firstRespondedAt?.toISOString() ?? null,
        assignee: r.assignee ?? null,
        // SLA fields: minutes since received, used by UI to color-code.
        waitingMinutes: r.firstRespondedAt
          ? null
          : Math.round((Date.now() - r.receivedAt.getTime()) / 60_000),
      }));

      // Backwards-compat: when called without pagination params, return the
      // bare array as before — existing UI code still works.
      const isPaginatedRequest = sp.has('limit') || sp.has('offset');
      if (isPaginatedRequest) {
        return successResponse({ items: normalized, total, unreadCount, limit, offset });
      }
      return successResponse(normalized);
    } catch (err) {
      logger.error('[admin/marketplaces/messages] GET failed', { error: err });
      return errorResponse('Помилка завантаження повідомлень', 500);
    }
  }
);
