import type { SupplierSyncMode } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { syncSupplierChannel, SupplierChannelError } from '@/services/supplier-channel';
import { syncSupplierConsignment } from '@/services/suppliers/sync';

/**
 * Normalised outcome of a sync, regardless of which engine ran. created/updated/
 * skipped are common to both; the consignment counters (matched/unmatched/
 * priceChanged) are 0 for catalog mode and the variant counters are 0 for
 * consignment mode.
 */
export interface SupplierSyncRun {
  channelId: number;
  mode: SupplierSyncMode;
  created: number;
  updated: number;
  skipped: number;
  variantsCreated: number;
  variantsUpdated: number;
  matched: number;
  unmatched: number;
  priceChanged: number;
}

/**
 * Single entry point for "sync this channel now". Routes by the channel's
 * syncMode: `price_stock` → consignment engine (cost+markup & stock of linked
 * products), otherwise → legacy catalog importer. Used by both the cron runner
 * and the admin "sync now" button so the two never diverge.
 */
export async function runSupplierSync(
  channelId: number,
  triggeredBy: number,
  options?: { dryRun?: boolean },
): Promise<SupplierSyncRun> {
  const channel = await prisma.supplierChannel.findUnique({
    where: { id: channelId },
    select: { syncMode: true },
  });
  if (!channel) throw new SupplierChannelError('Канал постачальника не знайдено', 404);

  if (channel.syncMode === 'price_stock') {
    const { result } = await syncSupplierConsignment(channelId, options);
    return {
      channelId,
      mode: 'price_stock',
      created: 0,
      updated: result.updated,
      skipped: result.skipped,
      variantsCreated: 0,
      variantsUpdated: 0,
      matched: result.matched,
      unmatched: result.unmatched,
      priceChanged: result.priceChanged,
    };
  }

  const { result } = await syncSupplierChannel(channelId, triggeredBy, options);
  return {
    channelId,
    mode: 'catalog_import',
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    variantsCreated: result.variantsCreated ?? 0,
    variantsUpdated: result.variantsUpdated ?? 0,
    matched: 0,
    unmatched: 0,
    priceChanged: 0,
  };
}
