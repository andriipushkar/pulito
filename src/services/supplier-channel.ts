import { prisma } from '@/lib/prisma';
import { importProducts, ImportResult } from '@/services/import';
import { logger } from '@/lib/logger';

export class SupplierChannelError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SupplierChannelError';
  }
}

const FETCH_TIMEOUT_MS = 60_000; // 60 seconds — supplier feeds can be large
const MAX_FEED_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Pull a feed from a supplier URL and pipe it through importProducts.
 * Honours the channel's auth settings (basic / bearer). Streams up to
 * MAX_FEED_SIZE so a runaway supplier endpoint doesn't OOM the worker.
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

  const headers: Record<string, string> = {
    'User-Agent': 'PulitoTrade-Importer/1.0',
  };
  if (channel.authType === 'basic' && channel.authUsername && channel.authPassword) {
    const token = Buffer.from(`${channel.authUsername}:${channel.authPassword}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  } else if (channel.authType === 'bearer' && channel.authToken) {
    headers['Authorization'] = `Bearer ${channel.authToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(channel.feedUrl, {
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new SupplierChannelError(
      `Не вдалося завантажити фід: ${err instanceof Error ? err.message : 'fetch error'}`,
      502,
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new SupplierChannelError(
      `Постачальник повернув ${response.status} ${response.statusText}`,
      502,
    );
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_FEED_SIZE) {
    throw new SupplierChannelError(
      `Фід занадто великий: ${Math.round(contentLength / 1024 / 1024)} MB (макс. 50)`,
      413,
    );
  }

  const arrayBuf = await response.arrayBuffer();
  if (arrayBuf.byteLength > MAX_FEED_SIZE) {
    throw new SupplierChannelError('Фід занадто великий (макс. 50 MB)', 413);
  }
  const buffer = Buffer.from(arrayBuf);

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
