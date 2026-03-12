import { NextResponse } from 'next/server';
import { getGoogleAuthUrl, generateOAuthState, GoogleOAuthError } from '@/services/google-oauth';
import { errorResponse } from '@/utils/api-response';
import { serialize } from 'cookie';

export async function GET() {
  try {
    const state = generateOAuthState();
    const url = getGoogleAuthUrl(state);

    // Store state in httpOnly cookie for validation in callback
    const response = NextResponse.redirect(url);
    response.headers.append(
      'Set-Cookie',
      serialize('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // lax needed for OAuth redirect flow
        path: '/api/v1/auth/google',
        maxAge: 600, // 10 minutes
      })
    );

    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка Google OAuth', 500);
  }
}
