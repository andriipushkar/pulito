import { prisma } from '@/lib/prisma';
import { SupplierChannelError } from '@/services/suppliers/feed-source';
import { fetchSupplierFeedBuffer } from '@/services/suppliers/feed-source';
import { parseSupplierFeed } from '@/services/suppliers/feed-parser';

export type FeedItemStatus = 'linked' | 'suggested' | 'unmatched';

export interface FeedPreviewItem {
  sku: string;
  name: string | null;
  barcode: string | null;
  purchasePrice: number | null;
  quantity: number;
  available: boolean;
  status: FeedItemStatus;
  /** product currently linked to this sku on THIS channel (status='linked') */
  linkedProductId: number | null;
  /** a likely match by code/barcode the admin can confirm (status='suggested') */
  suggestion: { productId: number; code: string; name: string } | null;
}

export interface FeedPreview {
  channelId: number;
  total: number;
  linked: number;
  suggested: number;
  unmatched: number;
  items: FeedPreviewItem[];
}

const PREVIEW_LIMIT = 2000;

/**
 * Fetch + parse a supplier feed and classify every line against our catalog so
 * an admin can confirm SKU→product links before the first real sync:
 *  - linked    — a product on this channel already carries this supplierSku
 *  - suggested — an unlinked product matches by code or barcode (one click to link)
 *  - unmatched — nothing matches; admin links manually or ignores
 *
 * Read-only: writes nothing. The confirm step is linkSupplierProducts().
 */
export async function previewSupplierFeed(channelId: number): Promise<FeedPreview> {
  const channel = await prisma.supplierChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw new SupplierChannelError('Канал постачальника не знайдено', 404);

  const buffer = await fetchSupplierFeedBuffer(channel);
  const items = (await parseSupplierFeed(buffer, channel.format)).slice(0, PREVIEW_LIMIT);

  const skus = items.map((i) => i.sku);
  const barcodes = items.map((i) => i.barcode).filter((b): b is string => !!b);

  // Products already linked to this channel, keyed by their supplierSku.
  const linkedRows = await prisma.product.findMany({
    where: { supplierId: channelId, supplierSku: { in: skus }, deletedAt: null },
    select: { id: true, supplierSku: true },
  });
  const linkedBySku = new Map(linkedRows.map((p) => [p.supplierSku as string, p.id]));

  // Candidate matches among UNLINKED products: by code == sku, or by barcode.
  const candidates = await prisma.product.findMany({
    where: {
      deletedAt: null,
      supplierId: null,
      OR: [{ code: { in: skus } }, ...(barcodes.length ? [{ barcode: { in: barcodes } }] : [])],
    },
    select: { id: true, code: true, name: true, barcode: true },
  });
  const candByCode = new Map(candidates.map((c) => [c.code, c]));
  const candByBarcode = new Map(
    candidates.filter((c) => c.barcode).map((c) => [c.barcode as string, c]),
  );

  let linked = 0;
  let suggested = 0;
  let unmatched = 0;
  const out: FeedPreviewItem[] = items.map((item) => {
    const linkedProductId = linkedBySku.get(item.sku) ?? null;
    if (linkedProductId) {
      linked++;
      return { ...toBase(item), status: 'linked', linkedProductId, suggestion: null };
    }
    const match =
      candByCode.get(item.sku) ?? (item.barcode ? candByBarcode.get(item.barcode) : undefined);
    if (match) {
      suggested++;
      return {
        ...toBase(item),
        status: 'suggested',
        linkedProductId: null,
        suggestion: { productId: match.id, code: match.code, name: match.name },
      };
    }
    unmatched++;
    return { ...toBase(item), status: 'unmatched', linkedProductId: null, suggestion: null };
  });

  return { channelId, total: out.length, linked, suggested, unmatched, items: out };
}

function toBase(item: {
  sku: string;
  name: string | null;
  barcode: string | null;
  purchasePrice: number | null;
  quantity: number;
  available: boolean;
}) {
  return {
    sku: item.sku,
    name: item.name,
    barcode: item.barcode,
    purchasePrice: item.purchasePrice,
    quantity: item.quantity,
    available: item.available,
  };
}

export interface LinkedProduct {
  id: number;
  code: string;
  name: string;
  supplierSku: string | null;
  cost: number | null;
  priceRetail: number;
  quantity: number;
  allowBackorder: boolean;
  markupOverrideType: 'percent' | 'fixed' | null;
  markupOverrideValue: number | null;
}

/** All products currently linked to a channel — the "what's driven by this
 *  supplier" view, with their per-product markup override. */
export async function getLinkedProducts(channelId: number): Promise<LinkedProduct[]> {
  const rows = await prisma.product.findMany({
    where: { supplierId: channelId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      supplierSku: true,
      cost: true,
      priceRetail: true,
      quantity: true,
      allowBackorder: true,
      markupOverrideType: true,
      markupOverrideValue: true,
    },
  });
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    supplierSku: p.supplierSku,
    cost: p.cost != null ? Number(p.cost) : null,
    priceRetail: Number(p.priceRetail),
    quantity: p.quantity,
    allowBackorder: p.allowBackorder,
    markupOverrideType: p.markupOverrideType,
    markupOverrideValue: p.markupOverrideValue != null ? Number(p.markupOverrideValue) : null,
  }));
}

/** Set (or clear) a per-product markup override — guarded to the channel that
 *  owns the product. Pass type=null to clear (falls back to the channel base). */
export async function setProductMarkupOverride(
  channelId: number,
  productId: number,
  type: 'percent' | 'fixed' | null,
  value: number | null,
): Promise<{ updated: boolean }> {
  const res = await prisma.product.updateMany({
    where: { id: productId, supplierId: channelId },
    data: {
      markupOverrideType: type,
      markupOverrideValue: type == null ? null : value,
    },
  });
  return { updated: res.count > 0 };
}

export interface LinkInput {
  sku: string;
  /** Target product by numeric id OR by its catalog code — whichever the admin
   *  has handy. At least one must be set. */
  productId?: number;
  productCode?: string;
}
export interface LinkResult {
  linked: number;
  skipped: { sku: string; reason: string }[];
}

/**
 * Confirm SKU→product links for a channel: stamps Product.supplierId +
 * supplierSku so future syncs drive that product. The target product may be
 * given by id or by catalog code. Guards:
 *  - a product already linked to a DIFFERENT channel is skipped (no stealing)
 *  - duplicate SKUs within the batch are skipped (the @@unique would reject them)
 * Each link is independent — one bad row never aborts the others.
 */
export async function linkSupplierProducts(
  channelId: number,
  links: LinkInput[],
): Promise<LinkResult> {
  const channel = await prisma.supplierChannel.findUnique({
    where: { id: channelId },
    select: { id: true, stockPolicy: true },
  });
  if (!channel) throw new SupplierChannelError('Канал постачальника не знайдено', 404);
  const allowBackorder = channel.stockPolicy === 'backorder';

  const skipped: LinkResult['skipped'] = [];
  const seenSku = new Set<string>();
  let linked = 0;

  for (const link of links) {
    const sku = link.sku?.trim();
    if (!sku) {
      skipped.push({ sku: link.sku ?? '', reason: 'порожній SKU' });
      continue;
    }
    if (seenSku.has(sku)) {
      skipped.push({ sku, reason: 'дубль SKU у запиті' });
      continue;
    }
    seenSku.add(sku);

    const product = link.productId
      ? await prisma.product.findUnique({
          where: { id: link.productId },
          select: { id: true, supplierId: true },
        })
      : link.productCode
        ? await prisma.product.findUnique({
            where: { code: link.productCode.trim() },
            select: { id: true, supplierId: true },
          })
        : null;

    if (!product) {
      skipped.push({ sku, reason: 'товар не знайдено' });
      continue;
    }
    if (product.supplierId != null && product.supplierId !== channelId) {
      skipped.push({ sku, reason: 'товар прив’язаний до іншого постачальника' });
      continue;
    }

    try {
      await prisma.product.update({
        where: { id: product.id },
        data: { supplierId: channelId, supplierSku: sku, allowBackorder },
      });
      linked++;
    } catch {
      // Most likely the @@unique([supplierId, supplierSku]) collided with an
      // existing link for the same sku on this channel.
      skipped.push({ sku, reason: 'SKU вже зайнятий на цьому каналі' });
    }
  }

  return { linked, skipped };
}

/**
 * Undo SKU→product links: clears supplierId + supplierSku for the given products
 * but only where they currently belong to THIS channel (can't unlink another
 * supplier's products). After unlinking, syncs stop touching them.
 */
export async function unlinkSupplierProducts(
  channelId: number,
  productIds: number[],
): Promise<{ unlinked: number }> {
  if (productIds.length === 0) return { unlinked: 0 };
  const res = await prisma.product.updateMany({
    where: { id: { in: productIds }, supplierId: channelId },
    data: { supplierId: null, supplierSku: null, allowBackorder: false },
  });
  return { unlinked: res.count };
}
