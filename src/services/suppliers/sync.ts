import { revalidatePath } from 'next/cache';
import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cacheInvalidate } from '@/services/cache';
import { fetchSupplierFeedBuffer, SupplierChannelError } from '@/services/suppliers/feed-source';
import { parseSupplierFeed } from '@/services/suppliers/feed-parser';
import { computeRetailPrice } from '@/services/suppliers/markup';
import { round2 } from '@/utils/money';

// Advisory-lock namespace ("SSYN") — serialises syncs of the SAME channel so a
// cron run and a manual "sync now" (or two cron ticks) can't race on the same
// products' stock/price. Per-channel: different channels still sync in parallel.
const SYNC_LOCK_NS = 0x5353_594e;
// Products written per DB transaction — keeps each tx bounded (a 10k feed won't
// blow the interactive-transaction timeout) while staying atomic per chunk.
const WRITE_CHUNK = 200;

/**
 * Result of a consignment (price_stock) sync. Exposes created/updated/skipped
 * so it slots into the same cron/admin formatting as the legacy catalog import
 * (created is always 0 — consignment never auto-creates products), plus richer
 * consignment-specific counters.
 */
export interface ConsignmentSyncResult {
  created: 0;
  updated: number; // linked products whose cost/price/stock changed
  skipped: number; // = unmatched (feed SKUs with no linked product)
  itemsTotal: number; // rows in the feed
  matched: number; // feed SKUs that hit a linked product
  unmatched: number; // feed SKUs with no linked product (candidates for first-import)
  priceChanged: number; // subset of updated where retail price moved
  syncLogId: number | null; // null on dry-run
  dryRun?: boolean;
}

/**
 * Consignment / dropship sync: a supplier feed drives the PURCHASE PRICE
 * (→ Product.cost), the derived retail price (cost + markup) and the stock of
 * products that are ALREADY LINKED to this channel (Product.supplierId). It
 * never creates products and never touches unlinked ones — linking is a
 * deliberate, manually-confirmed step (first-import, Phase 4).
 *
 * Fail-safe: if the feed can't be fetched or parsed, NOTHING is written
 * (stock/prices are left exactly as they were) and the failure is recorded on a
 * SupplierSyncLog row before the error propagates — a transient supplier outage
 * can never blank the catalog.
 */
export async function syncSupplierConsignment(
  channelId: number,
  options?: { dryRun?: boolean },
): Promise<{ channelId: number; result: ConsignmentSyncResult }> {
  const dryRun = options?.dryRun === true;
  const channel = await prisma.supplierChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw new SupplierChannelError('Канал постачальника не знайдено', 404);
  if (!channel.isActive) throw new SupplierChannelError('Канал вимкнено', 400);
  if (channel.syncMode !== 'price_stock') {
    throw new SupplierChannelError('Канал не в режимі price_stock', 400);
  }

  // Serialise writes for this channel (cron vs manual vs overlapping cron). A
  // dry-run only reads, so it never takes the lock. The lock auto-releases when
  // the DB connection returns to the pool; we also release explicitly in
  // `finally`. If another sync of this channel holds it, refuse fast.
  if (!dryRun) {
    const lockRows = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(${SYNC_LOCK_NS}::int, ${channel.id}::int) AS ok
    `;
    if (!lockRows[0]?.ok) {
      throw new SupplierChannelError('Синхронізація цього каналу вже виконується', 409);
    }
  }
  const releaseLock = async () => {
    if (dryRun) return;
    try {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${SYNC_LOCK_NS}::int, ${channel.id}::int)`;
    } catch {
      /* ignored — auto-released when the connection is reclaimed */
    }
  };

  try {
    return await runConsignmentSync(channel, dryRun);
  } finally {
    await releaseLock();
  }
}

async function runConsignmentSync(
  channel: NonNullable<Awaited<ReturnType<typeof prisma.supplierChannel.findUnique>>>,
  dryRun: boolean,
): Promise<{ channelId: number; result: ConsignmentSyncResult }> {
  // Open a log row up-front so a fetch/parse failure is still recorded. Skipped
  // for dry-runs (previews leave no trace).
  const log = dryRun
    ? null
    : await prisma.supplierSyncLog.create({
        data: { supplierId: channel.id, status: 'running', startedAt: new Date() },
      });

  // Any failure past this point marks the log `failed` instead of leaving it
  // stuck on `running` forever — covers both feed errors and write-phase errors.
  const failLog = async (err: unknown) => {
    const message = err instanceof Error ? err.message : 'sync error';
    if (log) {
      await prisma.supplierSyncLog
        .update({
          where: { id: log.id },
          data: { status: 'failed', errorLog: { message }, completedAt: new Date() },
        })
        .catch(() => {});
    }
    logger.error(`[suppliers/sync] #${channel.id} failed`, { message });
  };

  let items;
  try {
    const buffer = await fetchSupplierFeedBuffer(channel);
    items = await parseSupplierFeed(buffer, channel.format);
  } catch (err) {
    await failLog(err); // stock/prices untouched; caller decides how to alert
    throw err;
  }

  try {
    return await applyConsignmentItems(channel, log, items, dryRun);
  } catch (err) {
    await failLog(err);
    throw err;
  }
}

async function applyConsignmentItems(
  channel: NonNullable<Awaited<ReturnType<typeof prisma.supplierChannel.findUnique>>>,
  log: { id: number } | null,
  items: Awaited<ReturnType<typeof parseSupplierFeed>>,
  dryRun: boolean,
): Promise<{ channelId: number; result: ConsignmentSyncResult }> {
  // Linked products for this channel, keyed by their supplier SKU.
  const linked = await prisma.product.findMany({
    where: { supplierId: channel.id, supplierSku: { not: null }, deletedAt: null },
    select: {
      id: true,
      supplierSku: true,
      cost: true,
      priceRetail: true,
      quantity: true,
      allowBackorder: true,
      markupOverrideType: true,
      markupOverrideValue: true,
    },
  });
  const bySku = new Map(linked.map((p) => [p.supplierSku as string, p]));

  // Whether linked products stay sellable at 0 ("під замовлення").
  const wantBackorder = channel.stockPolicy === 'backorder';

  // Feed prices may be in another currency (e.g. EUR); convert to UAH cost.
  const currencyRate = channel.feedCurrencyRate != null ? Number(channel.feedCurrencyRate) : 1;

  // Reserve-aware stock: when the supplier feed does NOT drop on our orders,
  // subtract our open (unshipped) units so a sync can't re-expose sold stock.
  const openByProduct = new Map<number, number>();
  if (channel.reserveAware && linked.length > 0) {
    const grouped = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: linked.map((p) => p.id) },
        order: {
          status: { in: ['new_order', 'processing', 'confirmed', 'paid', 'packed'] },
          deletedAt: null,
        },
      },
      _sum: { quantity: true },
    });
    for (const g of grouped) {
      if (g.productId != null) openByProduct.set(g.productId, g._sum.quantity ?? 0);
    }
  }

  let updated = 0;
  let matched = 0;
  let unmatched = 0;
  let priceChanged = 0;
  const touchedProductIds: number[] = [];
  const seenProductIds = new Set<number>();
  // Writes are collected and flushed in bounded transactions (below) instead of
  // one-await-per-product, so a mid-loop crash can't leave a half-applied sync.
  const writeOps: Prisma.PrismaPromise<unknown>[] = [];

  for (const item of items) {
    const product = bySku.get(item.sku);
    if (!product) {
      unmatched++;
      continue;
    }
    matched++;
    seenProductIds.add(product.id);

    // Stock: a supplier marking the line unavailable forces 0. Under reserve-
    // aware mode, subtract our open (unshipped) units so we never re-expose
    // stock we've already promised.
    const reported = item.available ? item.quantity : 0;
    const reserved = channel.reserveAware ? (openByProduct.get(product.id) ?? 0) : 0;
    const newQuantity = Math.max(0, reported - reserved);

    // Cost & price: only recompute when the feed gave a usable purchase price.
    // A null (zeroed/garbage) price leaves the existing cost/price as-is so a
    // bad feed row can't publish a 0 UAH product — only stock updates.
    const oldCost = product.cost != null ? Number(product.cost) : null;
    const oldRetail = Number(product.priceRetail);

    let newCost = oldCost;
    let newRetail = oldRetail;
    if (item.purchasePrice != null) {
      // Convert the feed price to UAH (rate = 1 for a UAH feed). Route through
      // the money helper so rate multiplication can't leave float drift that
      // falsely flags a cost change (and a spurious priceHistory row) every run.
      newCost = round2(item.purchasePrice * currencyRate);
      const markupType = product.markupOverrideType ?? channel.markupType;
      const markupValue = Number(product.markupOverrideValue ?? channel.markupValue);
      const minPrice = channel.minPrice != null ? Number(channel.minPrice) : null;
      newRetail = computeRetailPrice(newCost, markupType, markupValue, minPrice);
    }

    const costChanged = newCost !== oldCost;
    const retailMoved = newRetail !== oldRetail;
    const stockChanged = newQuantity !== product.quantity;
    const backorderChanged = product.allowBackorder !== wantBackorder;
    if (!costChanged && !retailMoved && !stockChanged && !backorderChanged) continue; // nothing to write

    updated++;
    if (retailMoved) priceChanged++;

    if (!dryRun) {
      writeOps.push(
        prisma.product.update({
          where: { id: product.id },
          data: {
            quantity: newQuantity,
            ...(backorderChanged ? { allowBackorder: wantBackorder } : {}),
            ...(item.purchasePrice != null
              ? { cost: newCost, priceRetail: newRetail, priceRetailOld: product.priceRetail }
              : {}),
            version: { increment: 1 },
          },
        }),
      );
      touchedProductIds.push(product.id);

      if (retailMoved) {
        writeOps.push(
          prisma.priceHistory.create({
            data: {
              productId: product.id,
              priceRetailOld: product.priceRetail,
              priceRetailNew: newRetail,
            },
          }),
        );
      }
    }
  }

  // Flush the per-product writes in bounded transactions (atomic per chunk).
  for (let i = 0; i < writeOps.length; i += WRITE_CHUNK) {
    await prisma.$transaction(writeOps.slice(i, i + WRITE_CHUNK));
  }

  // Zero-missing: optionally take linked products absent from this feed to 0 —
  // but ONLY when the feed clearly wasn't truncated (it matched ≥50% of linked
  // products), so a partial download can't blank the catalog.
  let zeroed = 0;
  if (channel.zeroMissing && linked.length > 0 && seenProductIds.size / linked.length >= 0.5) {
    const missing = linked.filter((p) => !seenProductIds.has(p.id) && p.quantity !== 0);
    if (missing.length > 0) {
      zeroed = missing.length;
      updated += missing.length;
      if (!dryRun) {
        await prisma.product.updateMany({
          where: { id: { in: missing.map((p) => p.id) } },
          data: { quantity: 0, version: { increment: 1 } },
        });
        for (const p of missing) touchedProductIds.push(p.id);
      }
    }
  }

  if (!dryRun) {
    await prisma.supplierChannel.update({
      where: { id: channel.id },
      data: { lastSyncAt: new Date() },
    });
    if (log) {
      await prisma.supplierSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'completed',
          itemsTotal: items.length,
          itemsUpdated: updated,
          itemsUnmatched: unmatched,
          completedAt: new Date(),
        },
      });
    }
    if (touchedProductIds.length > 0) {
      await cacheInvalidate('products:*');
      revalidatePath('/catalog', 'layout');
      revalidatePath('/', 'layout');
    }
    logger.info(`[suppliers/sync] #${channel.id} (${channel.name}) ok`, {
      matched,
      updated,
      unmatched,
      priceChanged,
      zeroed,
    });
  }

  return {
    channelId: channel.id,
    result: {
      created: 0,
      updated,
      skipped: unmatched,
      itemsTotal: items.length,
      matched,
      unmatched,
      priceChanged,
      syncLogId: log?.id ?? null,
      ...(dryRun ? { dryRun: true } : {}),
    },
  };
}
