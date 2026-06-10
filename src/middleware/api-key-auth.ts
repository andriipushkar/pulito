import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import type { AuthedRouteHandler } from '@/middleware/auth';

export interface ApiKeyContext {
  apiKeyId: number;
  apiKeyName: string;
}

type ApiKeyHandler = (
  request: NextRequest,
  context: ApiKeyContext & { params?: Promise<Record<string, string>> },
) => Promise<NextResponse>;

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * API key authentication middleware for external integrations (1C/BAS).
 * Extracts API key from `Authorization: Bearer <key>` or `X-API-Key` header,
 * validates it against the ApiKey table, checks permissions, and updates lastUsedAt.
 */
export function withApiKey(permissions?: string[]) {
  // AuthedRouteHandler is an overload pair: Next's route-type validator reads
  // the last call signature (required segmentData), tests and non-dynamic
  // routes use the first. See src/middleware/auth.ts.
  return (handler: ApiKeyHandler): AuthedRouteHandler =>
    async (
      request: NextRequest,
      segmentData?: { params?: Promise<Record<string, string>> },
    ): Promise<NextResponse> => {
      // Extract key from headers
      const authHeader = request.headers.get('authorization');
      const xApiKey = request.headers.get('x-api-key');

      let rawKey: string | null = null;
      if (authHeader?.startsWith('Bearer ')) {
        rawKey = authHeader.slice(7);
      } else if (xApiKey) {
        rawKey = xApiKey;
      }

      if (!rawKey) {
        return errorResponse('API key not provided', 401);
      }

      const keyHash = hashApiKey(rawKey);

      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
      });

      if (!apiKey) {
        return errorResponse('Invalid API key', 401);
      }

      if (!apiKey.isActive) {
        return errorResponse('API key is deactivated', 403);
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return errorResponse('API key has expired', 403);
      }

      // Check permissions
      if (permissions && permissions.length > 0) {
        const keyPermissions = apiKey.permissions as Record<string, boolean>;
        const hasAllPermissions = permissions.every((p) => keyPermissions[p] === true);
        if (!hasAllPermissions) {
          return errorResponse('Insufficient permissions', 403);
        }
      }

      // Per-key rate-limit. Protects DB from a runaway 1C cron (or a stolen
      // key) and keeps our own outbound footprint inside 1C's quota window.
      const rl = await checkRateLimit(`apikey:${apiKey.id}`, RATE_LIMITS.integration1c);
      if (!rl.allowed) {
        return errorResponse(`Перевищено ліміт API key. Спробуйте через ${rl.retryAfter} с.`, 429);
      }

      // Update lastUsedAt (fire-and-forget)
      prisma.apiKey
        .update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});

      return handler(request, {
        apiKeyId: apiKey.id,
        apiKeyName: apiKey.name,
        params: segmentData?.params,
      });
    };
}

/**
 * Generate a new API key and return the raw key (only shown once) and its hash.
 */
export function generateApiKey(): { rawKey: string; keyHash: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const rawKey = `csk_${Buffer.from(bytes).toString('hex')}`;
  const prefix = rawKey.slice(0, 8);
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyHash, prefix };
}
