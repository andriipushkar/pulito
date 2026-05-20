import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { randomBytes } from 'crypto';
import { redis } from '@/lib/redis';
import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import { errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';

/**
 * Step 1 of the OLX OAuth wizard.
 * Generates a state token, stashes it in Redis (10-min TTL), and redirects
 * the admin to OLX consent screen. After consent OLX will POST/GET back to
 * /api/v1/admin/marketplaces/olx/oauth-callback?code=…&state=…
 */
export const GET = withRole('admin')(async (_request: NextRequest) => {
  const config = (await getChannelConfig('olx')) as MarketplaceConfig | null;
  if (!config?.clientId) {
    return errorResponse(
      'Спочатку вкажіть Client ID у налаштуваннях OLX, потім запускайте візард.',
      400,
    );
  }

  const state = randomBytes(16).toString('hex');
  await redis.setex(`olx:oauth:state:${state}`, 600, '1');

  const redirectUri = `${env.APP_URL}/api/v1/admin/marketplaces/olx/oauth-callback`;
  const url = new URL('https://www.olx.ua/api/open/oauth/authorize');
  url.searchParams.set('client_id', String(config.clientId));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'read write v2');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
});
