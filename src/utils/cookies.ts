import { serialize } from 'cookie';

const REFRESH_COOKIE_NAME = 'refresh_token';
const COOKIE_PATH = '/api/v1/auth';

// Dev Tunnels and similar proxies use HTTPS even in development
const appUrl = process.env.APP_URL || '';
const isSecure = process.env.NODE_ENV === 'production' || appUrl.startsWith('https');
const isDevTunnel = appUrl.includes('devtunnels.ms') || appUrl.includes('ngrok') || appUrl.includes('loca.lt');

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
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}
