import { NextRequest } from 'next/server';
import { serialize } from 'cookie';
import { successResponse, errorResponse } from '@/utils/api-response';

function getOAuthAccessTokenCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === 'oauth_access_token') return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * One-time exchange: read the short-lived oauth_access_token cookie
 * and return it in the JSON body, then clear the cookie.
 * This avoids exposing access tokens in URLs (Referer header leak).
 */
export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  const accessToken = getOAuthAccessTokenCookie(cookieHeader);

  if (!accessToken) {
    return errorResponse('No OAuth access token found', 401);
  }

  // Clear the one-time cookie
  const response = successResponse({ accessToken });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.append(
    'Set-Cookie',
    serialize('oauth_access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth/oauth-exchange',
      maxAge: 0,
    })
  );

  return response;
}
