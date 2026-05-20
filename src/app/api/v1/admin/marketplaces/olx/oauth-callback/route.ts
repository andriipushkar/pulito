import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { redis } from '@/lib/redis';
import {
  getChannelConfig,
  saveChannelConfig,
  type MarketplaceConfig,
} from '@/services/channel-config';
import { env } from '@/config/env';

/**
 * Step 2 of the OLX OAuth wizard.
 * OLX redirects here with `code` + `state`. We verify state, swap code for
 * tokens, persist them (encrypted by saveChannelConfig), then bounce the
 * admin back to /admin/marketplaces?olx=connected.
 */
export const GET = withRole('admin')(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const fail = (reason: string) =>
    NextResponse.redirect(`${env.APP_URL}/admin/marketplaces?olx=error&reason=${encodeURIComponent(reason)}`);

  if (error) return fail(error);
  if (!code || !state) return fail('Відсутні code або state');

  // Validate state to defeat CSRF.
  const stateKey = `olx:oauth:state:${state}`;
  const stored = await redis.get(stateKey);
  if (!stored) return fail('State протерміновано або невалідний');
  await redis.del(stateKey);

  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.clientId || !config?.clientSecret) {
    return fail('Client ID/Secret не налаштовані');
  }

  const redirectUri = `${env.APP_URL}/api/v1/admin/marketplaces/olx/oauth-callback`;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: String(config.clientId),
    client_secret: String(config.clientSecret),
    code,
    redirect_uri: redirectUri,
  });

  try {
    const res = await fetch('https://www.olx.ua/api/open/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      return fail(data.error_description || data.error || `HTTP ${res.status}`);
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : '';

    await saveChannelConfig('olx', {
      ...config,
      enabled: true,
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      ...(expiresAt ? { accessTokenExpiresAt: expiresAt } : {}),
    });

    return NextResponse.redirect(`${env.APP_URL}/admin/marketplaces?olx=connected`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Помилка обміну коду');
  }
});
