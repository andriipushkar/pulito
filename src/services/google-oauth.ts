import { randomBytes, createHmac } from 'crypto';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { logger } from '@/lib/logger';

export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Generate a signed OAuth state parameter to prevent CSRF.
 * Format: <random_nonce>.<hmac_signature>
 */
export function generateOAuthState(): string {
  const nonce = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', env.APP_SECRET)
    .update(nonce)
    .digest('hex');
  return `${nonce}.${signature}`;
}

/**
 * Verify the OAuth state parameter signature.
 */
export function verifyOAuthState(state: string): boolean {
  const parts = state.split('.');
  if (parts.length !== 2) return false;
  const [nonce, signature] = parts;
  const expectedSignature = createHmac('sha256', env.APP_SECRET)
    .update(nonce)
    .digest('hex');
  if (!timingSafeCompare(expectedSignature, signature)) {
    return false;
  }
  return true;
}

export function getGoogleAuthUrl(state: string): string {
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new GoogleOAuthError('Google OAuth not configured');
  }

  const redirectUri = `${env.APP_URL}/api/v1/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new GoogleOAuthError('Google OAuth not configured');
  }

  const redirectUri = `${env.APP_URL}/api/v1/auth/google/callback`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    logger.error('Google token exchange failed', { error: data.error_description || data.error || 'Unknown error' });
    throw new GoogleOAuthError('Помилка автентифікації Google', 401);
  }

  return data as GoogleTokenResponse;
}

export async function getGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();

  if (!res.ok || !data.id) {
    logger.error('Google user profile fetch failed', { error: data.error?.message || 'Unknown error' });
    throw new GoogleOAuthError('Помилка отримання профілю Google', 401);
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}
