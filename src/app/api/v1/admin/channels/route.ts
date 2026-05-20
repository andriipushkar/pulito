import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const [stats, recentPublications] = await Promise.all([
        prisma.channelStats.findMany({
          orderBy: { recordedAt: 'desc' },
          take: 10,
        }),
        prisma.publication.findMany({
          where: { status: 'published' },
          orderBy: { publishedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            title: true,
            channels: true,
            publishedAt: true,
            igMediaId: true,
            igPermalink: true,
            tgMessageId: true,
            viberMsgToken: true,
          },
        }),
      ]);

      return successResponse({ stats, recentPublications });
    } catch (err) {
      logger.error('[admin/channels] GET failed', { error: err });
      return errorResponse('Помилка завантаження статистики каналів', 500);
    }
  }
);
