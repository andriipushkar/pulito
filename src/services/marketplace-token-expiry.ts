import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import {
  MARKETPLACE_PLATFORMS,
  type MarketplacePlatform,
} from '@/services/marketplace-health';

export interface TokenExpiryInfo {
  platform: MarketplacePlatform;
  hasToken: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  /** 'unknown' when no expiry tracked, 'fresh' >7d, 'warn' 3-7d, 'critical' <3d, 'expired' past */
  health: 'unknown' | 'fresh' | 'warn' | 'critical' | 'expired' | 'no-token';
}

const WARN_DAYS = 7;
const CRITICAL_DAYS = 3;

function expiryHealth(daysRemaining: number | null, hasToken: boolean): TokenExpiryInfo['health'] {
  if (!hasToken) return 'no-token';
  if (daysRemaining == null) return 'unknown';
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining < CRITICAL_DAYS) return 'critical';
  if (daysRemaining < WARN_DAYS) return 'warn';
  return 'fresh';
}

export async function getTokenExpiryInfo(
  platform: MarketplacePlatform,
): Promise<TokenExpiryInfo> {
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  const hasToken =
    typeof config?.accessToken === 'string'
      ? config.accessToken.length > 0
      : typeof config?.apiKey === 'string'
      ? config.apiKey.length > 0
      : typeof config?.apiToken === 'string'
      ? config.apiToken.length > 0
      : false;

  const rawExpiry = config?.accessTokenExpiresAt;
  let expiresAt: string | null = null;
  let daysRemaining: number | null = null;
  if (typeof rawExpiry === 'string' && rawExpiry) {
    const t = Date.parse(rawExpiry);
    if (!Number.isNaN(t)) {
      expiresAt = rawExpiry;
      daysRemaining = Math.floor((t - Date.now()) / (24 * 60 * 60 * 1000));
    }
  }

  return {
    platform,
    hasToken,
    expiresAt,
    daysRemaining,
    health: expiryHealth(daysRemaining, hasToken),
  };
}

export async function getAllTokenExpiryInfo(): Promise<TokenExpiryInfo[]> {
  return Promise.all(MARKETPLACE_PLATFORMS.map((p) => getTokenExpiryInfo(p)));
}
