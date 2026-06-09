// Client-side recovery from stale-asset errors after a deploy.
//
// When a new build ships, old `/_next/static/chunks/*.js` files disappear from
// the server. A returning visitor whose tab/cache still references the previous
// build's chunk hashes gets a hard `ChunkLoadError` the moment Next tries to
// lazy-load a route — which surfaces as the "Критична помилка" boundary.
//
// The durable fix is the per-build service-worker cache versioning (see
// public/sw.js). This helper is the safety net for visitors who are ALREADY
// holding a poisoned service worker / cache: on a chunk error we unregister the
// worker, drop every cache, and reload once so the browser fetches a clean
// document + matching chunks. Guarded so it can never loop.

const RELOAD_GUARD_KEY = 'pulito:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * True when the error is a missing/failed JS or CSS chunk (deploy skew), not a
 * real application bug. `name` is checked because Next's webpack runtime sets
 * `error.name = 'ChunkLoadError'` even when the message is minified or empty.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  const haystack = `${err.name ?? ''} ${err.message ?? ''}`;
  return (
    err.name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(
      haystack,
    )
  );
}

/**
 * Purge the service worker + caches and reload once. No-ops (returns false) if
 * we already reloaded within the cooldown, so a chunk error that survives the
 * reload falls through to the normal error UI instead of looping forever.
 */
export function recoverFromChunkError(): boolean {
  if (typeof window === 'undefined') return false;

  let last = 0;
  try {
    last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
  } catch {
    // sessionStorage can throw in private mode — treat as "no prior reload".
  }

  const now = Date.now();
  if (last && now - last < RELOAD_COOLDOWN_MS) {
    return false;
  }

  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  } catch {
    // ignore — guard is best-effort
  }

  const cleanup = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
  };

  // Reload regardless of whether cleanup succeeds — getting a fresh document is
  // what actually breaks the skew; cleanup just stops it from recurring.
  void cleanup().finally(() => window.location.reload());
  return true;
}
