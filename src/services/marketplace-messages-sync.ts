import { prisma } from '@/lib/prisma';
import { getMarketplaceMessages } from '@/services/marketplaces';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('messages');

const PLATFORMS = ['olx', 'rozetka', 'prom'] as const;

/**
 * Pulls live messages from each marketplace API and upserts them into the
 * local `marketplace_messages` table. UI reads from the table — refresh on
 * every tab toggle no longer hits the marketplace API.
 *
 * Idempotent: `@@unique([platform, externalThreadId])` keeps inserts safe;
 * existing rows have their `isRead` flag and `text` (latest message) updated.
 */
export async function syncMarketplaceMessages(): Promise<{
  synced: number;
  perPlatform: Record<string, number>;
}> {
  let synced = 0;
  const perPlatform: Record<string, number> = {};
  // Aggregated for a single push-notification at the end (one ping per cron run).
  const newByPlatform: Record<string, number> = {};

  for (const platform of PLATFORMS) {
    perPlatform[platform] = 0;
    try {
      const messages = await getMarketplaceMessages(platform);
      for (const msg of messages) {
        const existing = await prisma.marketplaceMessage.findUnique({
          where: {
            platform_externalThreadId: {
              platform,
              externalThreadId: msg.id,
            },
          },
          select: { id: true, isRead: true },
        });

        if (existing) {
          if (existing.isRead !== msg.isRead) {
            await prisma.marketplaceMessage.update({
              where: { id: existing.id },
              data: {
                text: msg.text,
                isRead: msg.isRead,
                listingTitle: msg.listingTitle ?? null,
                externalListingId: msg.listingId || null,
              },
            });
          }
        } else {
          await prisma.marketplaceMessage.create({
            data: {
              platform,
              externalThreadId: msg.id,
              externalListingId: msg.listingId || null,
              listingTitle: msg.listingTitle ?? null,
              buyerName: msg.buyerName,
              text: msg.text,
              isFromBuyer: true,
              isRead: msg.isRead,
              receivedAt: new Date(msg.createdAt),
            },
          });
          synced++;
          perPlatform[platform]++;
          newByPlatform[platform] = (newByPlatform[platform] || 0) + 1;
        }
      }
    } catch (err) {
      log.error('sync error', {
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fire-and-forget single push when any new messages arrived in this run.
  const totalNew = Object.values(newByPlatform).reduce((s, n) => s + n, 0);
  if (totalNew > 0) {
    const parts = Object.entries(newByPlatform)
      .map(([p, n]) => `${p}: ${n}`)
      .join(', ');

    // Web Push to admin browsers (existing).
    void (async () => {
      try {
        const { sendPushToAdmins } = await import('@/services/push');
        await sendPushToAdmins({
          title: `💬 ${totalNew} нових повідомлень з маркетплейсів`,
          body: parts,
          url: '/admin/marketplaces',
        });
      } catch (err) {
        log.error('push admin notify failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    // Telegram ping to manager channel — separate channel from web push so
    // the message reaches the owner even when the browser is closed. Uses
    // the same TELEGRAM_MANAGER_CHAT_ID env as new-order notifications.
    void (async () => {
      try {
        const { notifyManagerMarketplaceMessages } = await import('@/services/telegram');
        await notifyManagerMarketplaceMessages({ total: totalNew, perPlatform: newByPlatform });
      } catch (err) {
        log.error('telegram admin notify failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  return { synced, perPlatform };
}

export async function markMessageResponded(id: number): Promise<void> {
  await prisma.marketplaceMessage.update({
    where: { id },
    data: { firstRespondedAt: new Date(), isRead: true },
  });
}
