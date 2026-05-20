'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface SidebarCounts {
  newOrders: number;
  newFeedback: number;
  pendingWholesale: number;
}

const POLL_INTERVAL_MS = 60_000;

/**
 * Polls /api/v1/admin/sidebar-counts every 60 seconds.
 * Pauses while the tab is hidden to avoid wasted queries.
 */
export function useSidebarCounts(): SidebarCounts {
  const [counts, setCounts] = useState<SidebarCounts>({
    newOrders: 0,
    newFeedback: 0,
    pendingWholesale: 0,
  });

  const load = useCallback(() => {
    apiClient.get<SidebarCounts>('/api/v1/admin/sidebar-counts').then((res) => {
      if (res.success && res.data) setCounts(res.data);
    });
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      load();
      interval = setInterval(load, POLL_INTERVAL_MS);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    const onAdminEvent = () => load();
    window.addEventListener('admin:new-order', onAdminEvent);
    window.addEventListener('admin:new-review', onAdminEvent);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('admin:new-order', onAdminEvent);
      window.removeEventListener('admin:new-review', onAdminEvent);
      stop();
    };
  }, [load]);

  return counts;
}
