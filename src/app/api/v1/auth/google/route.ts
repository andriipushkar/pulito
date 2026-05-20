import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleAuthUrl,
  generateOAuthState,
  GoogleOAuthError,
  isSafeReturnUrl,
} from '@/services/google-oauth';
import { errorResponse } from '@/utils/api-response';

// State is HMAC-signed + timestamped (see services/google-oauth.ts) and
// carries an optional returnUrl, so the callback can resume the user's
// originally-intended destination (e.g. /admin) without a server-side
// cookie. Previously we set an `oauth_state` cookie too; that single-key
// store collided when the user opened "Login with Google" in two tabs.
export async function GET(request: NextRequest) {
  try {
    const returnUrlParam = request.nextUrl.searchParams.get('returnUrl');
    const returnUrl = returnUrlParam && isSafeReturnUrl(returnUrlParam) ? returnUrlParam : undefined;

    const state = generateOAuthState(returnUrl);
    const url = getGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof GoogleOAuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка Google OAuth', 500);
  }
}
