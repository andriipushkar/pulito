import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getGoogleUserProfile,
  verifyOAuthState,
  GoogleOAuthError,
} from '@/services/google-oauth';
import { loginWithGoogle } from '@/services/auth';
import { parseTtlToSeconds } from '@/services/token';
import { serializeRefreshTokenCookie } from '@/utils/cookies';
import { getClientIp, getDeviceInfo } from '@/utils/request';
import { logger } from '@/lib/logger';
import { env } from '@/config/env';
import { logAudit } from '@/services/audit';

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

    // State is HMAC-signed and includes a timestamp + the original
    // returnUrl. Verifying server-side is enough — no cookie needed.
    const verification = state ? verifyOAuthState(state) : { valid: false as const };
    if (!verification.valid) {
      return NextResponse.redirect(`${env.APP_URL}/auth/login?error=invalid_state`);
    }

    const tokenData = await exchangeCodeForTokens(code);
    const profile = await getGoogleUserProfile(tokenData.access_token);

    const ipAddress = getClientIp(request);
    const deviceInfo = getDeviceInfo(request);

    const result = await loginWithGoogle(
      profile.id,
      profile.email,
      profile.name,
      profile.picture,
      undefined,
      ipAddress,
      deviceInfo,
    );

    // If 2FA is required, redirect to the login page in 2FA step with the
    // temp token. No refresh cookie is set — full credentials are only issued
    // after the TOTP code is verified.
    if (result.requiresTwoFactor) {
      const redirectUrl = new URL('/auth/login', env.APP_URL);
      redirectUrl.searchParams.set('step', '2fa');
      redirectUrl.searchParams.set('tempToken', result.tempToken);
      if (verification.returnUrl) {
        redirectUrl.searchParams.set('returnUrl', verification.returnUrl);
      }
      return NextResponse.redirect(redirectUrl.toString());
    }

    const { user, tokens } = result;
    await logAudit({
      userId: user.id,
      actionType: 'login',
      entityType: 'user',
      entityId: user.id,
      details: { method: 'google' },
      ipAddress,
    });

    // Redirect to the client callback page, forwarding the verified
    // returnUrl so AuthCallbackPage knows where to land once AuthProvider
    // hydrates. The refresh_token cookie alone is enough — AuthProvider's
    // mount-effect hits /api/v1/auth/refresh which returns both the access
    // token and the user. Issuing a separate oauth_access_token cookie
    // used to require a second /auth/refresh from the callback page, which
    // raced with AuthProvider's auto-refresh and occasionally tripped the
    // refresh-token-reuse detector ("інколи кілька раз потрібно" symptom).
    const redirectUrl = new URL('/auth/callback', env.APP_URL);
    if (verification.returnUrl) {
      redirectUrl.searchParams.set('returnUrl', verification.returnUrl);
    }

    const refreshTtl = parseTtlToSeconds(env.JWT_REFRESH_TTL);
    const response = NextResponse.redirect(redirectUrl.toString());

    response.headers.append(
      'Set-Cookie',
      serializeRefreshTokenCookie(tokens.refreshToken, refreshTtl),
    );

    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthError) {
      logger.error('Google OAuth callback failed', {
        statusCode: error.statusCode,
        message: error.message,
      });
      return NextResponse.redirect(`${env.APP_URL}/auth/login?error=oauth_failed`);
    }
    logger.error('Google OAuth callback unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(`${env.APP_URL}/auth/login?error=server_error`);
  }
}
