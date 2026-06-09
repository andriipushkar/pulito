// TEMPORARY diagnostic: ships client-side crash details to the server so they
// land in pm2 logs (`[client-error]`). Used to capture an iOS-Chrome-only crash
// that doesn't reproduce on desktop. Remove once the root cause is found.

export function reportClientError(error: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    const err = error as { message?: string; stack?: string; digest?: string };
    const payload = JSON.stringify({
      message: err?.message ?? String(error ?? ''),
      stack: err?.stack ?? '',
      digest: err?.digest ?? '',
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
    // sendBeacon survives the boundary unmount / navigation; fall back to fetch.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/v1/log-client-error',
        new Blob([payload], { type: 'application/json' }),
      );
    } else {
      void fetch('/api/v1/log-client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // diagnostics must never throw
  }
}
