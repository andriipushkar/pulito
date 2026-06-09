import { NextRequest } from 'next/server';
import { successResponse } from '@/utils/api-response';

// TEMPORARY diagnostic endpoint — records client-side crashes in the server log
// (pm2) so we can capture an iOS-Chrome-only error that can't be inspected on a
// Linux box. Unauthenticated by design (the crash happens for guests too) but
// every field is length-capped so it can't be abused as a log-flood vector.
// Remove together with src/lib/client-error-log.ts once the bug is fixed.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cap = (v: unknown, n: number) => String(v ?? '').slice(0, n);
    console.error(
      '[client-error]',
      JSON.stringify({
        message: cap(body.message, 500),
        digest: cap(body.digest, 100),
        url: cap(body.url, 300),
        userAgent: cap(body.userAgent, 300),
        stack: cap(body.stack, 2000),
      }),
    );
  } catch {
    // ignore — diagnostics must never break
  }
  return successResponse({ ok: true });
}
