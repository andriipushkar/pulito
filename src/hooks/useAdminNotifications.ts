'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient, getAccessToken } from '@/lib/api-client';

interface AdminNotification {
  id: string;
  type: 'new_order' | 'new_review';
  message: string;
  timestamp: string;
}

// Grant TTL is 5 min on the server. Refresh well before that so a slow tab
// doesn't drop notifications between grant expiry and reconnect.
const GRANT_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [connected, setConnected] = useState(false);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    // Bail if user isn't logged in — saves a useless grant request.
    if (!getAccessToken()) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let grantInterval: ReturnType<typeof setInterval>;
    let cancelled = false;

    // Hit /sse-grant first to set the HttpOnly cookie EventSource will send.
    // No-store on the response, so the browser doesn't cache a stale grant.
    const requestGrant = async (): Promise<boolean> => {
      const res = await apiClient.post('/api/v1/admin/sse-grant', {});
      return res.success;
    };

    const connect = async () => {
      const granted = await requestGrant();
      if (cancelled) return;
      if (!granted) {
        // Not an admin / 2FA disabled / server error — stay disconnected
        // rather than retrying in a hot loop.
        return;
      }
      es = new EventSource('/api/v1/admin/notifications/stream');

      es.addEventListener('open', () => setConnected(true));

      es.addEventListener('new_order', (e) => {
        const data = JSON.parse(e.data);
        const total = data.latest?.totalAmount ? ` на ${data.latest.totalAmount} грн` : '';
        setNotifications((prev) => [
          {
            id: `order-${Date.now()}`,
            type: 'new_order',
            message: `Нове замовлення #${data.latest?.orderNumber || ''}${total}`,
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
        window.dispatchEvent(new CustomEvent('admin:new-order', { detail: data }));
      });

      es.addEventListener('new_review', (e) => {
        const data = JSON.parse(e.data);
        setNotifications((prev) => [
          {
            id: `review-${Date.now()}`,
            type: 'new_review',
            message: `${data.count} нових відгуків на модерацію`,
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
        window.dispatchEvent(new CustomEvent('admin:new-review', { detail: data }));
      });

      es.addEventListener('error', () => {
        setConnected(false);
        es?.close();
        es = null;
        if (!cancelled) retryTimeout = setTimeout(connect, 5000);
      });
    };

    connect();
    // Refresh the cookie before TTL so a long-lived tab stays authorized.
    // The fetch is cheap and re-issues the cookie via Set-Cookie.
    grantInterval = setInterval(() => {
      void requestGrant();
    }, GRANT_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      es?.close();
      clearTimeout(retryTimeout);
      clearInterval(grantInterval);
    };
  }, []);

  return { notifications, connected, dismiss, dismissAll };
}
