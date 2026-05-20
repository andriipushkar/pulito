import { prisma } from '@/lib/prisma';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('error-detector');

const FAILURES_WINDOW_MIN = 10;
const FAILURES_THRESHOLD = 5;
const ALERT_COOLDOWN_KEY = 'marketplace_error_alert_cooldown';
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between alerts

interface DetectionResult {
  alerted: boolean;
  failuresByPlatform: Record<string, number>;
  totalFailures: number;
  windowMin: number;
}

/**
 * Scans publication_channels for recent failures (last 10 min). When the
 * count crosses FAILURES_THRESHOLD, fires a Telegram alert. Cooldown
 * prevents spam.
 */
export async function detectErrorPattern(): Promise<DetectionResult> {
  const since = new Date(Date.now() - FAILURES_WINDOW_MIN * 60 * 1000);

  const recent = await prisma.publicationChannel.findMany({
    where: {
      status: 'failed',
      createdAt: { gte: since },
      channel: { in: ['olx', 'rozetka', 'prom', 'epicentrk'] },
    },
    select: { channel: true },
  });

  const failuresByPlatform: Record<string, number> = {};
  for (const r of recent) {
    failuresByPlatform[r.channel] = (failuresByPlatform[r.channel] || 0) + 1;
  }
  const total = recent.length;

  if (total < FAILURES_THRESHOLD) {
    return { alerted: false, failuresByPlatform, totalFailures: total, windowMin: FAILURES_WINDOW_MIN };
  }

  const cooldown = await prisma.siteSetting.findUnique({ where: { key: ALERT_COOLDOWN_KEY } });
  if (cooldown?.value) {
    const last = Date.parse(cooldown.value);
    if (!Number.isNaN(last) && Date.now() - last < ALERT_COOLDOWN_MS) {
      return { alerted: false, failuresByPlatform, totalFailures: total, windowMin: FAILURES_WINDOW_MIN };
    }
  }

  try {
    const { notifyManagerMarketplaceAlert } = await import('@/services/telegram');
    const worstPlatform = Object.entries(failuresByPlatform).sort((a, b) => b[1] - a[1])[0]?.[0] || 'olx';
    await notifyManagerMarketplaceAlert({
      platform: worstPlatform as 'olx' | 'rozetka' | 'prom' | 'epicentrk',
      error: `${total} помилок публікації за ${FAILURES_WINDOW_MIN} хв (${Object.entries(failuresByPlatform).map(([p, c]) => `${p}:${c}`).join(', ')})`,
      previousStatus: 'ok',
      newStatus: 'error-spike',
    });
  } catch (err) {
    log.error('alert send failed', { error: err instanceof Error ? err.message : String(err) });
  }

  await prisma.siteSetting.upsert({
    where: { key: ALERT_COOLDOWN_KEY },
    create: { key: ALERT_COOLDOWN_KEY, value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });

  return { alerted: true, failuresByPlatform, totalFailures: total, windowMin: FAILURES_WINDOW_MIN };
}
