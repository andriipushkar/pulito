import { env } from '@/config/env';

// Serves the IndexNow key-verification file. Engines fetch this URL (sent as
// `keyLocation` in each submission) and confirm its body equals the key before
// trusting our URL pings. 404 when no key is configured so the path doesn't
// advertise an empty file. The key is public by design.
export async function GET() {
  if (!env.INDEXNOW_KEY) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(env.INDEXNOW_KEY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
