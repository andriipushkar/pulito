import { getInstagramCreds, saveRefreshedInstagramToken } from '@/services/channel-config';
import { logger } from '@/lib/logger';

/**
 * Refresh the Instagram long-lived access token and PERSIST it.
 *
 * Instagram long-lived tokens last 60 days and can be refreshed once they are
 * ≥24h old. This job runs well before expiry (cron ~every few days), exchanges
 * the current token for a fresh 60-day one via the IG Graph endpoint, and
 * writes it back to the channel_instagram config so every subsequent API call
 * uses the renewed token. (The previous version discarded the new token, so the
 * refresh was a no-op and the token still expired at day 60.)
 */
export async function refreshInstagramToken(): Promise<{
  refreshed: boolean;
  expiresIn?: number;
  expiresAt?: string;
  error?: string;
}> {
  const { accessToken } = await getInstagramCreds();
  if (!accessToken) {
    return { refreshed: false, error: 'Instagram access token not configured' };
  }

  try {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('[instagram-token-refresh] API returned non-OK', { status: res.status, body });
      return { refreshed: false, error: `Instagram API error: ${res.status} ${body}`.trim() };
    }

    const data = (await res.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
    };

    if (!data.access_token || typeof data.expires_in !== 'number') {
      return { refreshed: false, error: 'Instagram API did not return a token' };
    }

    await saveRefreshedInstagramToken(data.access_token, data.expires_in);
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    logger.info('[instagram-token-refresh] token refreshed and persisted', { expiresAt });

    // Never return the token itself — only when it now expires.
    return { refreshed: true, expiresIn: data.expires_in, expiresAt };
  } catch (err) {
    return {
      refreshed: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
