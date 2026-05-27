import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const MAX_PATH_LENGTH = 1000;
const MAX_HEADER_LENGTH = 500;

// Probe-path prefixes we skip so the log doesn't fill with crawler noise.
// We log paths a *user* might genuinely land on, not bot fingerprinting.
const SKIP_PREFIXES = [
  '/.', // dotfiles (.env, .git, .vscode)
  '/wp-', // WordPress probes
  '/wordpress',
  '/cgi-bin/',
  '/api/', // server-side API paths — already authenticated/checked
  '/_next/', // Next.js asset paths (legitimate misses become build issues)
  '/static/', // static/uploads
  '/favicon', // browser auto-requests
  '/.well-known/',
];

const SKIP_SUFFIXES = ['.php', '.env', '.asp', '.aspx', '.jsp', '.cgi'];

/** Strip control chars + truncate. Headers come from arbitrary clients
 * (curl, bots) and can contain `\r\n` to break log parsers or `<script>`
 * that leaks if a future admin tool renders them as innerHTML. */
function sanitizeHeader(s: string | null | undefined): string | null {
  if (!s) return null;

  return s.replace(/[\x00-\x1F<>]/g, '').slice(0, MAX_HEADER_LENGTH) || null;
}

/**
 * Records a 404 hit so admins can find broken internal links or missing slug
 * redirects. Called from the not-found.tsx client beacon. One row per unique
 * path; subsequent hits bump count + lastSeenAt instead of creating dupes.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.publicLog404);
    if (!rl.allowed) {
      return successResponse({ skipped: true, reason: 'rate-limited' });
    }

    const body = await request.json();
    const rawPath = typeof body?.path === 'string' ? body.path : '';
    if (!rawPath) return errorResponse("path обов'язковий", 400);

    // Drop query strings + hash so /foo?a=1 and /foo?a=2 dedupe to /foo. Keeps
    // the table small and admin view useful — query-string variance is noise.
    let path: string;
    try {
      const parsed = new URL(rawPath, 'http://localhost');
      path = parsed.pathname.slice(0, MAX_PATH_LENGTH);
    } catch {
      path = rawPath.slice(0, MAX_PATH_LENGTH);
    }

    if (
      SKIP_PREFIXES.some((p) => path.startsWith(p)) ||
      SKIP_SUFFIXES.some((s) => path.endsWith(s))
    ) {
      return successResponse({ skipped: true });
    }

    const referrer = sanitizeHeader(typeof body?.referrer === 'string' ? body.referrer : null);
    const userAgent = sanitizeHeader(request.headers.get('user-agent'));

    await prisma.notFoundLog.upsert({
      where: { path },
      create: { path, referrer, userAgent },
      update: {
        count: { increment: 1 },
        // Keep newest referrer/UA — easier to debug "who's linking here now".
        ...(referrer && { referrer }),
        ...(userAgent && { userAgent }),
      },
    });

    return successResponse({ logged: true });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
