import { NextResponse } from 'next/server';
import { getGoogleAuthUrl, generateOAuthState, GoogleOAuthError } from '@/services/google-oauth';
import { errorResponse } from '@/utils/api-response';

// State is HMAC-signed + timestamped (see services/google-oauth.ts), so the
// callback can verify it without a server-side cookie. Previously we set an
// `oauth_state` cookie too; that single-key store collided when the user
// opened "Login with Google" in two tabs simultaneously.
export async function GET() {
  try {
    const state = generateOAuthState();
    const url = getGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof GoogleOAuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка Google OAuth', 500);
  }
}
