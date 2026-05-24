import { serialize } from 'cookie';

const REFRESH_COOKIE_NAME = 'refresh_token';
const COOKIE_PATH = '/';

// Dev Tunnels and similar proxies use HTTPS even in development
const appUrl = process.env.APP_URL || '';
const isSecure = process.env.NODE_ENV === 'production' || appUrl.startsWith('https');
const isDevTunnel =
  appUrl.includes('devtunnels.ms') || appUrl.includes('ngrok') || appUrl.includes('loca.lt');

// For dev tunnels: use 'none' sameSite (requires secure) to allow cross-origin cookies
const sameSite: 'lax' | 'none' = isDevTunnel ? 'none' : 'lax';

export function serializeRefreshTokenCookie(token: string, maxAgeSeconds: number): string {
  return serialize(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: COOKIE_PATH,
    maxAge: maxAgeSeconds,
  });
}

export function serializeClearRefreshTokenCookie(): string {
  return serialize(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: COOKIE_PATH,
    maxAge: 0,
  });
}

export function getRefreshTokenFromCookies(cookieHeader: string | null): string | null {
  const all = getAllRefreshTokensFromCookies(cookieHeader);
  return all[0] ?? null;
}

// Returns every refresh_token value present in the header, in order. Browsers
// can send multiple cookies with the same name when paths differ — picking
// only the first one (which is what older callers did) can return a stale
// revoked token from a previous deploy while a fresh one sits later in the
// list. `/auth/refresh` uses this to try each token and pick the one that's
// still valid.
export function getAllRefreshTokensFromCookies(cookieHeader: string | null): string[] {
  if (!cookieHeader) return [];
  const tokens: string[] = [];
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === REFRESH_COOKIE_NAME) {
      tokens.push(decodeURIComponent(rest.join('=')));
    }
  }
  return tokens;
}
