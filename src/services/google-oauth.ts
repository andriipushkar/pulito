import { randomBytes, createHmac } from 'crypto';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';
import { logger } from '@/lib/logger';

export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
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
  /** Whether Google has verified ownership of this email. */
  emailVerified: boolean;
  name: string;
  picture?: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Generate a signed OAuth state parameter to prevent CSRF.
 * Format: <nonce>.<timestamp>.<returnUrlB64>.<hmac_signature>
 *
 * The timestamp + optional post-login returnUrl are part of the signed
 * payload so verification can reject replayed/expired states and trust the
 * returnUrl without a server-side cookie. Earlier versions used an
 * oauth_state cookie: a single-key store that two tabs would overwrite,
 * leaving the first tab's callback with an `invalid_state` error.
 */
const STATE_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Whether `path` is a safe same-origin relative path to redirect to.
 * Rejects absolute URLs, protocol-relative (//), and anything with control
 * chars / backslashes that some servers normalise into scheme switches.
 */
export function isSafeReturnUrl(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (/[\\\r\n\t]/.test(path)) return false;
  return true;
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

function b64urlDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

export function generateOAuthState(returnUrl?: string): string {
  const nonce = randomBytes(16).toString('hex');
  const ts = Date.now().toString();
  const safeReturn = returnUrl && isSafeReturnUrl(returnUrl) ? returnUrl : '';
  const returnEnc = b64urlEncode(safeReturn);
  const payload = `${nonce}.${ts}.${returnEnc}`;
  const signature = createHmac('sha256', env.APP_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export type OAuthStateVerification = { valid: true; returnUrl: string | null } | { valid: false };

/**
 * Verify a signed OAuth state: HMAC integrity + age check.
 * Returns the embedded returnUrl when valid, or null if none / unsafe.
 */
export function verifyOAuthState(state: string): OAuthStateVerification {
  if (!state || typeof state !== 'string') return { valid: false };
  const parts = state.split('.');
  if (parts.length !== 4) return { valid: false };
  const [nonce, ts, returnEnc, signature] = parts;
  const expectedSignature = createHmac('sha256', env.APP_SECRET)
    .update(`${nonce}.${ts}.${returnEnc}`)
    .digest('hex');
  if (!timingSafeCompare(expectedSignature, signature)) {
    return { valid: false };
  }
  const issuedAt = Number(ts);
  if (!Number.isFinite(issuedAt)) return { valid: false };
  const age = Date.now() - issuedAt;
  if (age < 0 || age > STATE_MAX_AGE_MS) return { valid: false };

  let returnUrl: string | null = null;
  try {
    const decoded = b64urlDecode(returnEnc);
    if (decoded && isSafeReturnUrl(decoded)) {
      returnUrl = decoded;
    }
  } catch {
    // Malformed returnUrl payload — treat as no returnUrl.
  }
  return { valid: true, returnUrl };
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
    logger.error('Google token exchange failed', {
      status: res.status,
      error: data.error_description || data.error || 'Unknown error',
      codePrefix: code.slice(0, 8),
    });
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
    logger.error('Google user profile fetch failed', {
      status: res.status,
      error: data.error?.message || 'Unknown error',
    });
    throw new GoogleOAuthError('Помилка отримання профілю Google', 401);
  }

  return {
    id: data.id,
    email: data.email,
    // userinfo v2 returns `verified_email`; OIDC returns `email_verified`.
    emailVerified: data.verified_email === true || data.email_verified === true,
    name: data.name,
    picture: data.picture,
  };
}
