import { refreshOlxToken } from '@/services/marketplaces';
import { getChannelConfig } from '@/services/channel-config';
import type { MarketplaceConfig } from '@/services/channel-config';

export interface TokenRefreshResult {
  platform: string;
  refreshed: boolean;
  expiresIn?: number;
  error?: string;
}

/**
 * Refreshes OAuth/access tokens for marketplaces that support refresh flows.
 * OLX is the only platform with explicit refresh-token grant today; Rozetka
 * issues short-lived `content.token` via API key, Prom uses static API tokens,
 * Epicentr uses static API keys. This job will short-circuit those platforms.
 */
export async function refreshMarketplaceTokens(): Promise<TokenRefreshResult[]> {
  const results: TokenRefreshResult[] = [];

  const olxConfig = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (olxConfig?.enabled && olxConfig.clientId && olxConfig.refreshToken) {
    const r = await refreshOlxToken();
    results.push({
      platform: 'olx',
      refreshed: r.success,
      expiresIn: r.expiresIn,
      error: r.error,
    });
  }

  return results;
}
