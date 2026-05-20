import { prisma } from '@/lib/prisma';
import {
  getChannelConfig,
  testChannelConnection,
  type ChannelType,
  type MarketplaceConfig,
} from '@/services/channel-config';

export type MarketplacePlatform = 'olx' | 'rozetka' | 'prom' | 'epicentrk';

export const MARKETPLACE_PLATFORMS: readonly MarketplacePlatform[] = [
  'olx',
  'rozetka',
  'prom',
  'epicentrk',
] as const;

export function isMarketplacePlatform(value: string): value is MarketplacePlatform {
  return (MARKETPLACE_PLATFORMS as readonly string[]).includes(value);
}

export interface HealthCheckResult {
  status: 'ok' | 'error' | 'disabled' | 'unconfigured';
  checkedAt: string;
  latencyMs: number;
  accountName?: string;
  error?: string;
}

const HEALTH_KEY = (platform: string) => `marketplace_health_${platform}`;

export async function runHealthCheck(platform: MarketplacePlatform): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  const previous = await getHealthStatus(platform);

  if (!config) {
    const result: HealthCheckResult = {
      status: 'unconfigured',
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
      error: 'Креденшели не збережено',
    };
    await persistHealthResult(platform, result);
    return result;
  }

  if (!config.enabled) {
    const result: HealthCheckResult = {
      status: 'disabled',
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
      error: 'Маркетплейс вимкнено',
    };
    await persistHealthResult(platform, result);
    return result;
  }

  const ping = await testChannelConnection(platform as ChannelType, config);
  const result: HealthCheckResult = {
    status: ping.success ? 'ok' : 'error',
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    accountName: ping.name,
    error: ping.success ? undefined : ping.error || 'Невідома помилка',
  };
  await persistHealthResult(platform, result);

  // Alert manager only when transitioning into error from a known-good or
  // never-checked state — avoid spamming on every cron tick.
  if (
    result.status === 'error' &&
    previous?.status !== 'error' &&
    previous?.status !== 'disabled'
  ) {
    try {
      const { notifyManagerMarketplaceAlert } = await import('@/services/telegram');
      await notifyManagerMarketplaceAlert({
        platform,
        error: result.error || 'Невідома помилка',
        previousStatus: previous?.status || 'never-checked',
        newStatus: result.status,
      });
    } catch {
      // Notification failure must not break the health check
    }
  }

  return result;
}

const HISTORY_KEY = (platform: string) => `marketplace_health_history_${platform}`;
const HISTORY_MAX_ENTRIES = 200;

async function persistHealthResult(
  platform: MarketplacePlatform,
  result: HealthCheckResult,
): Promise<void> {
  const key = HEALTH_KEY(platform);
  const value = JSON.stringify(result);
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  // Append to history (rolling buffer, last N entries)
  try {
    const historyKey = HISTORY_KEY(platform);
    const existing = await prisma.siteSetting.findUnique({ where: { key: historyKey } });
    let history: { checkedAt: string; status: string; latencyMs: number }[] = [];
    if (existing?.value) {
      try {
        history = JSON.parse(existing.value);
      } catch {
        history = [];
      }
    }
    history.push({
      checkedAt: result.checkedAt,
      status: result.status,
      latencyMs: result.latencyMs,
    });
    if (history.length > HISTORY_MAX_ENTRIES) {
      history = history.slice(-HISTORY_MAX_ENTRIES);
    }
    const histValue = JSON.stringify(history);
    await prisma.siteSetting.upsert({
      where: { key: historyKey },
      create: { key: historyKey, value: histValue },
      update: { value: histValue },
    });
  } catch {
    // History is best-effort
  }
}

export interface HealthHistoryEntry {
  checkedAt: string;
  status: string;
  latencyMs: number;
}

export async function getHealthHistory(
  platform: MarketplacePlatform,
): Promise<HealthHistoryEntry[]> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: HISTORY_KEY(platform) } });
  if (!setting?.value) return [];
  try {
    return JSON.parse(setting.value) as HealthHistoryEntry[];
  } catch {
    return [];
  }
}

export interface LatencyPercentiles {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

export function computeLatencyPercentiles(history: HealthHistoryEntry[]): LatencyPercentiles {
  const samples = history
    .filter((h) => h.status === 'ok' && Number.isFinite(h.latencyMs) && h.latencyMs > 0)
    .map((h) => h.latencyMs)
    .sort((a, b) => a - b);
  if (samples.length === 0) return { count: 0, p50: 0, p95: 0, p99: 0, avg: 0 };
  const pick = (q: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))];
  const avg = Math.round(samples.reduce((s, v) => s + v, 0) / samples.length);
  return {
    count: samples.length,
    p50: pick(0.5),
    p95: pick(0.95),
    p99: pick(0.99),
    avg,
  };
}

export function computeUptimePercent(history: HealthHistoryEntry[]): number {
  if (history.length === 0) return 0;
  const ok = history.filter((h) => h.status === 'ok').length;
  return Math.round((ok / history.length) * 100);
}

export interface UptimeBuckets {
  d7: number;
  d30: number;
  d90: number;
  /** total samples in each bucket (denominator) */
  samples: { d7: number; d30: number; d90: number };
}

export function computeUptimeBuckets(history: HealthHistoryEntry[], now: Date = new Date()): UptimeBuckets {
  const cutoff = (days: number) => now.getTime() - days * 24 * 60 * 60 * 1000;
  const buckets: { days: number; key: 'd7' | 'd30' | 'd90' }[] = [
    { days: 7, key: 'd7' },
    { days: 30, key: 'd30' },
    { days: 90, key: 'd90' },
  ];
  const result: UptimeBuckets = { d7: 0, d30: 0, d90: 0, samples: { d7: 0, d30: 0, d90: 0 } };
  for (const { days, key } of buckets) {
    const since = cutoff(days);
    const window = history.filter((h) => new Date(h.checkedAt).getTime() >= since);
    result.samples[key] = window.length;
    if (window.length > 0) {
      const ok = window.filter((h) => h.status === 'ok').length;
      result[key] = Math.round((ok / window.length) * 100);
    }
  }
  return result;
}

const LOW_UPTIME_ALERT_KEY = (platform: string) => `marketplace_uptime_alert_${platform}`;
const LOW_UPTIME_THRESHOLD = 90;
const ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // re-alert at most every 12h

/**
 * Triggers a Telegram alert when 30-day uptime drops below LOW_UPTIME_THRESHOLD.
 * Stores the last-alerted timestamp in siteSetting to honour the cooldown.
 */
export async function maybeAlertLowUptime(platform: MarketplacePlatform): Promise<boolean> {
  const history = await getHealthHistory(platform);
  if (history.length < 10) return false; // not enough signal
  const buckets = computeUptimeBuckets(history);
  if (buckets.d30 >= LOW_UPTIME_THRESHOLD || buckets.samples.d30 === 0) return false;

  const cooldownKey = LOW_UPTIME_ALERT_KEY(platform);
  const last = await prisma.siteSetting.findUnique({ where: { key: cooldownKey } });
  if (last?.value) {
    const t = Date.parse(last.value);
    if (!Number.isNaN(t) && Date.now() - t < ALERT_COOLDOWN_MS) return false;
  }

  try {
    const { notifyManagerMarketplaceAlert } = await import('@/services/telegram');
    await notifyManagerMarketplaceAlert({
      platform,
      error: `Низький uptime: ${buckets.d30}% за 30 днів`,
      previousStatus: 'ok',
      newStatus: 'low-uptime',
    });
  } catch {
    // alert failure must not break health check
  }
  const now = new Date().toISOString();
  await prisma.siteSetting.upsert({
    where: { key: cooldownKey },
    create: { key: cooldownKey, value: now },
    update: { value: now },
  });
  return true;
}

export async function getHealthStatus(
  platform: MarketplacePlatform,
): Promise<HealthCheckResult | null> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: HEALTH_KEY(platform) } });
  if (!setting?.value) return null;
  try {
    return JSON.parse(setting.value) as HealthCheckResult;
  } catch {
    return null;
  }
}

export async function getAllHealthStatuses(): Promise<
  Record<MarketplacePlatform, HealthCheckResult | null>
> {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: MARKETPLACE_PLATFORMS.map((p) => HEALTH_KEY(p)) } },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const out = {} as Record<MarketplacePlatform, HealthCheckResult | null>;
  for (const platform of MARKETPLACE_PLATFORMS) {
    const raw = map.get(HEALTH_KEY(platform));
    if (raw) {
      try {
        out[platform] = JSON.parse(raw) as HealthCheckResult;
        continue;
      } catch {
        /* fall through */
      }
    }
    out[platform] = null;
  }
  return out;
}

// ── Auto-sync intervals (persisted in siteSetting) ──

export type SyncInterval = 'off' | '1h' | '6h' | '12h' | '24h';
export type SyncType = 'products' | 'stock' | 'orders';

export type AutoSyncSettings = Record<
  MarketplacePlatform,
  Partial<Record<SyncType, SyncInterval>>
>;

const AUTOSYNC_KEY = 'marketplace_autosync_v2';

const DEFAULT_SETTINGS: AutoSyncSettings = {
  olx: { products: 'off', stock: 'off', orders: 'off' },
  rozetka: { products: 'off', stock: 'off', orders: 'off' },
  prom: { products: 'off', stock: 'off', orders: 'off' },
  epicentrk: { products: 'off', stock: 'off', orders: 'off' },
};

export async function getAutoSyncSettings(): Promise<AutoSyncSettings> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: AUTOSYNC_KEY } });
  if (!setting?.value) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(setting.value) as Partial<AutoSyncSettings>;
    const merged = { ...DEFAULT_SETTINGS };
    for (const platform of MARKETPLACE_PLATFORMS) {
      merged[platform] = { ...DEFAULT_SETTINGS[platform], ...(parsed[platform] || {}) };
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAutoSyncSettings(settings: AutoSyncSettings): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: AUTOSYNC_KEY },
    create: { key: AUTOSYNC_KEY, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
}

const INTERVAL_MS: Record<SyncInterval, number> = {
  off: 0,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export function isSyncDue(
  interval: SyncInterval,
  lastSyncIso: string | null | undefined,
): boolean {
  if (interval === 'off') return false;
  if (!lastSyncIso) return true;
  const lastMs = new Date(lastSyncIso).getTime();
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= INTERVAL_MS[interval];
}
