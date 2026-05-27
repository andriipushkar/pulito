'use client';

import { useEffect } from 'react';

/** Client-side beacon that pings /api/v1/log-404 once when the 404 page mounts.
 * Lets admins find broken internal links via the admin SEO panel. */
export default function NotFoundLogger() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({
      path: window.location.pathname,
      referrer: document.referrer || null,
    });

    // sendBeacon survives page unload (user clicks "back" immediately) and
    // doesn't block. Fall back to fetch when unavailable (older browsers).
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/v1/log-404', blob);
    } else {
      fetch('/api/v1/log-404', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  return null;
}
