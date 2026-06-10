import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/services/token';
import { isAccessTokenBlacklisted } from '@/services/auth';
import { errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/types/auth';

interface AuthContext {
  user: AuthUser;
}

type AuthHandler = (
  request: NextRequest,
  context: AuthContext & { params?: Promise<Record<string, string>> },
) => Promise<NextResponse>;

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

// Overload pair instead of one optional param: Next's route-type validator
// infers the 2nd argument from the LAST call signature and rejects
// `RouteContext | undefined`, so that signature keeps segmentData required.
// Unit tests call wrappers through the first signature with the request only.
// At runtime non-dynamic routes may omit it either way — it's read with
// optional chaining.
export type AuthedRouteHandler = {
  (request: NextRequest): Promise<NextResponse>;
  (
    request: NextRequest,
    segmentData: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse>;
};

export function withAuth(handler: AuthHandler): AuthedRouteHandler {
  return async (
    request: NextRequest,
    segmentData?: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const token = extractBearerToken(request);
    if (!token) {
      return errorResponse('Токен не надано', 401);
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return errorResponse('Невалідний або прострочений токен', 401);
    }

    const blacklisted = await isAccessTokenBlacklisted(token);
    if (blacklisted) {
      return errorResponse('Токен відкликано', 401);
    }

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return handler(request, { user, params: segmentData?.params });
  };
}

interface OptionalAuthContext {
  user: AuthUser | null;
}

type OptionalAuthHandler = (
  request: NextRequest,
  context: OptionalAuthContext & { params?: Promise<Record<string, string>> },
) => Promise<NextResponse>;

export function withOptionalAuth(handler: OptionalAuthHandler): AuthedRouteHandler {
  // See AuthedRouteHandler above for why the overload pair exists.
  return async (
    request: NextRequest,
    segmentData?: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const token = extractBearerToken(request);
    if (!token) {
      return handler(request, { user: null, params: segmentData?.params });
    }

    try {
      const payload = verifyAccessToken(token);
      const blacklisted = await isAccessTokenBlacklisted(token);
      if (blacklisted) {
        return handler(request, { user: null, params: segmentData?.params });
      }

      const user: AuthUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return handler(request, { user, params: segmentData?.params });
    } catch {
      return handler(request, { user: null, params: segmentData?.params });
    }
  };
}

export function withRole(...roles: string[]) {
  return (handler: AuthHandler) => {
    return withAuth(async (request, context) => {
      if (!roles.includes(context.user.role)) {
        return errorResponse('Недостатньо прав', 403);
      }
      return handler(request, context);
    });
  };
}

/**
 * Role gate that ALSO requires the user to have 2FA enabled. Use for
 * sensitive admin endpoints (payments, users, billing, etc.) so a stolen
 * admin token cannot bypass the layout-only 2FA check.
 *
 * Adds one DB read per request — keep usage to critical routes.
 */
export function withRole2fa(...roles: string[]) {
  return (handler: AuthHandler) => {
    return withAuth(async (request, context) => {
      if (!roles.includes(context.user.role)) {
        return errorResponse('Недостатньо прав', 403);
      }
      const dbUser = await prisma.user.findUnique({
        where: { id: context.user.id },
        select: { twoFactorEnabled: true },
      });
      if (!dbUser?.twoFactorEnabled) {
        return errorResponse('Потрібна двофакторна автентифікація', 403);
      }
      return handler(request, { ...context, user: { ...context.user, twoFactorEnabled: true } });
    });
  };
}
