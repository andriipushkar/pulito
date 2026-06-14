import { prisma } from '@/lib/prisma';
import { importProducts, ImportResult } from '@/services/import';
import { logger } from '@/lib/logger';
import { fetchSupplierFeedBuffer, SupplierChannelError } from '@/services/suppliers/feed-source';

// Re-exported so existing importers (`@/services/supplier-channel`) keep working
// after the error class + feed fetch moved into the shared suppliers module.
export { SupplierChannelError };

/**
 * Pull a feed from a supplier URL and pipe it through importProducts. This is
 * the legacy CATALOG import path: it creates/updates products from the feed at
 * the feed's own price. The consignment price/stock sync (markup, supplier
 * link, dropship) lives separately in services/suppliers/.
 *
 * Caller is expected to be admin/manager — channels live in the integrations
 * area, not on the storefront.
 */
export async function syncSupplierChannel(
  channelId: number,
  triggeredBy: number,
  options?: { dryRun?: boolean },
): Promise<{ channelId: number; result: ImportResult }> {
  const channel = await prisma.supplierChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw new SupplierChannelError('Канал постачальника не знайдено', 404);
  if (!channel.isActive) throw new SupplierChannelError('Канал вимкнено', 400);

  const buffer = await fetchSupplierFeedBuffer(channel);

  const filename = `supplier-${channel.id}-${channel.format}-${Date.now()}`;
  const result = await importProducts(buffer, filename, triggeredBy, options);

  // Only persist sync state for real imports — dry-runs are previews.
  if (!options?.dryRun) {
    await prisma.supplierChannel.update({
      where: { id: channel.id },
      data: {
        lastSyncAt: new Date(),
        lastImportLogId: result.importLogId,
      },
    });
    logger.info('[supplier-channel] sync completed', {
      channelId: channel.id,
      importLogId: result.importLogId,
      created: result.created,
      updated: result.updated,
    });
  }

  return { channelId: channel.id, result };
}
