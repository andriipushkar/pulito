import { prisma } from '@/lib/prisma';
import { deleteMarketplaceListing } from '@/services/marketplaces';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('listing-archive');

const RESTORE_WINDOW_DAYS = 30;

/**
 * Soft-archives a marketplace listing: sets PublicationChannel.status to
 * 'archived' and records archivedAt via the errorMessage field (we don't
 * have a dedicated column — repurpose it with a known prefix).
 *
 * The listing remains on the marketplace itself until either the restore
 * window expires (auto hard-delete cron) or the admin confirms permanent
 * delete via deleteListing().
 */
const ARCHIVED_AT_PREFIX = '__archived_at__:';

export async function archiveListing(publicationChannelId: number): Promise<void> {
  const at = new Date().toISOString();
  await prisma.publicationChannel.update({
    where: { id: publicationChannelId },
    data: { status: 'archived', errorMessage: `${ARCHIVED_AT_PREFIX}${at}` },
  });
}

export async function restoreListing(publicationChannelId: number): Promise<void> {
  await prisma.publicationChannel.update({
    where: { id: publicationChannelId },
    data: { status: 'published', errorMessage: null },
  });
}

/**
 * Cron-callable: permanently delete archived listings whose archive window
 * has passed. Calls the marketplace DELETE first; the local row is removed
 * only after the marketplace acknowledges (or returns 404).
 */
export async function purgeExpiredArchivedListings(): Promise<{
  purged: number;
  failed: number;
}> {
  const cutoff = new Date(Date.now() - RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.publicationChannel.findMany({
    where: { status: 'archived' },
    select: { id: true, channel: true, externalId: true, errorMessage: true },
  });

  let purged = 0;
  let failed = 0;

  for (const row of candidates) {
    if (!row.errorMessage?.startsWith(ARCHIVED_AT_PREFIX)) continue;
    const ts = Date.parse(row.errorMessage.slice(ARCHIVED_AT_PREFIX.length));
    if (Number.isNaN(ts) || ts > cutoff.getTime()) continue;

    try {
      if (row.externalId) {
        const r = await deleteMarketplaceListing(row.channel, row.externalId);
        if (r.status === 'failed') {
          log.warn('Marketplace delete failed during purge', {
            id: row.id,
            channel: row.channel,
            error: r.error,
          });
          failed++;
          continue;
        }
      }
      await prisma.publicationChannel.delete({ where: { id: row.id } });
      purged++;
    } catch (err) {
      log.error('Purge error', {
        id: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  return { purged, failed };
}

export function getArchivedAt(channel: { errorMessage: string | null }): string | null {
  if (!channel.errorMessage?.startsWith(ARCHIVED_AT_PREFIX)) return null;
  return channel.errorMessage.slice(ARCHIVED_AT_PREFIX.length);
}
