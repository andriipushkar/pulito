/**
 * Cross-tab refresh coordination.
 *
 * Refresh tokens are single-use: the server rotates them on every
 * /auth/refresh call and treats a revoked token coming back as a stolen
 * token, nuking every session of that user ("token reuse detected"). When
 * a user has multiple tabs open and they all fire /auth/refresh at the
 * same moment (e.g. simultaneous API 401s, or the old setInterval), one
 * tab wins and the others come back with already-rotated tokens — the
 * reuse-detector then logs everyone out.
 *
 * `navigator.locks` serialises refresh attempts across same-origin tabs
 * so only one refresh is in flight at a time; subsequent ones run after
 * the previous releases, by which point each tab has the freshest
 * refresh_token cookie and rotation works cleanly.
 *
 * Fallback path (older browsers, server-side prerender) just runs `fn`
 * directly — no cross-tab coordination, but better than crashing.
 */
export async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request('pulito-auth-refresh', { mode: 'exclusive' }, fn);
  }
  return fn();
}
