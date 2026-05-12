import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import {
  exchangeCodeForTokens,
  getGoogleUserProfile,
  verifyOAuthState,
  GoogleOAuthError,
} from '@/services/google-oauth';
import { loginWithGoogle } from '@/services/auth';
import { parseTtlToSeconds } from '@/services/token';
import { serializeRefreshTokenCookie } from '@/utils/cookies';
import { env } from '@/config/env';

function getOAuthStateCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === 'oauth_state') return decodeURIComponent(rest.join('='));
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');
    const state = request.nextUrl.searchParams.get('state');

    if (error) {
      return NextResponse.redirect(`${env.APP_URL}/auth/login?error=oauth_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${env.APP_URL}/auth/login?error=no_code`);
    }

    // Verify OAuth state parameter to prevent CSRF
    const storedState = getOAuthStateCookie(request.headers.get('cookie'));
    if (!state || !storedState || state !== storedState || !verifyOAuthState(state)) {
      return NextResponse.redirect(`${env.APP_URL}/auth/login?error=invalid_state`);
    }

    const tokenData = await exchangeCodeForTokens(code);
    const profile = await getGoogleUserProfile(tokenData.access_token);

    const { tokens } = await loginWithGoogle(
      profile.id,
      profile.email,
      profile.name,
      profile.picture,
    );

    // Redirect to the client callback page. The refresh_token cookie alone is
    // enough — AuthProvider's mount-effect hits /api/v1/auth/refresh which
    // returns both the access token and the user. Issuing a separate
    // oauth_access_token cookie used to require a second /auth/refresh from
    // the callback page, which raced with AuthProvider's auto-refresh and
    // occasionally tripped the refresh-token-reuse detector, nuking the
    // user's sessions ("інколи кілька раз потрібно" symptom).
    const redirectUrl = new URL('/auth/callback', env.APP_URL);

    const refreshTtl = parseTtlToSeconds(env.JWT_REFRESH_TTL);
    const response = NextResponse.redirect(redirectUrl.toString());

    response.headers.append(
      'Set-Cookie',
      serializeRefreshTokenCookie(tokens.refreshToken, refreshTtl),
    );

    // Clear the oauth_state cookie
    response.headers.append(
      'Set-Cookie',
      serialize('oauth_state', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth/google',
        maxAge: 0,
      }),
    );

    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthError) {
      return NextResponse.redirect(`${env.APP_URL}/auth/login?error=oauth_failed`);
    }
    return NextResponse.redirect(`${env.APP_URL}/auth/login?error=server_error`);
  }
}
