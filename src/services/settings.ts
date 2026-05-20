import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, CACHE_TTL } from '@/services/cache';
import { redis } from '@/lib/redis';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/types/settings';
import { decrypt, isEncrypted } from '@/lib/encryption';

// Keys stored encrypted in DB. Cached versions are already decrypted so
// runtime code can use them directly (e.g. payment SDK init).
const ENCRYPTED_KEYS = new Set([
  'payment_liqpay_private_key',
  'payment_monobank_token',
  'payment_wayforpay_secret_key',
  'smtp_pass',
  'delivery_nova_poshta_api_key',
  'delivery_ukrposhta_bearer_token',
]);

function tryDecrypt(value: string): string {
  if (!value || !isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

const CACHE_KEY = 'site:settings';
const MEMORY_TTL_MS = 60_000;

let memoryCache: { data: SiteSettings; expires: number } | null = null;

export async function getSettings(): Promise<SiteSettings> {
  // 1. In-memory cache
  if (memoryCache && Date.now() < memoryCache.expires) {
    return memoryCache.data;
  }

  // 2. Redis cache
  try {
    const cached = await cacheGet<Record<string, string>>(CACHE_KEY);
    if (cached) {
      const merged = { ...DEFAULT_SETTINGS, ...cached } as SiteSettings;
      memoryCache = { data: merged, expires: Date.now() + MEMORY_TTL_MS };
      return merged;
    }
  } catch {
    // fall through to DB
  }

  // 3. Database — decrypt ENCRYPTED_KEYS as we hydrate the cache so callers
  // never see ciphertext.
  try {
    const rows = await prisma.siteSetting.findMany();
    const map = Object.fromEntries(
      rows.map((r) => [r.key, ENCRYPTED_KEYS.has(r.key) ? tryDecrypt(r.value) : r.value]),
    );
    const settings = { ...DEFAULT_SETTINGS, ...map } as SiteSettings;

    await cacheSet(CACHE_KEY, map, CACHE_TTL.MEDIUM);
    memoryCache = { data: settings, expires: Date.now() + MEMORY_TTL_MS };
    return settings;
  } catch {
    // If DB is down, return defaults
    return DEFAULT_SETTINGS;
  }
}

export async function invalidateSettingsCache(): Promise<void> {
  memoryCache = null;
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // silently fail
  }
}
