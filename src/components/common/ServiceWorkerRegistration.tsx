'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export default function ServiceWorkerRegistration() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Handle SW update — activate new worker immediately
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New SW ready — tell it to take over
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });

    // Reload on controller change (new SW activated)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  // Proactively cache visited product pages
  const cacheCurrentPage = useCallback(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !navigator.serviceWorker?.controller
    ) {
      return;
    }

    // Cache product pages user visits for offline access
    if (pathname?.startsWith('/product/')) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_URLS',
        urls: [pathname],
      });
    }
  }, [pathname]);

  useEffect(() => {
    cacheCurrentPage();
  }, [cacheCurrentPage]);

  return null;
}
