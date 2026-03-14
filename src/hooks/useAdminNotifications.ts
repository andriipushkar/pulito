'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAccessToken } from '@/lib/api-client';

interface AdminNotification {
  id: string;
  type: 'new_order' | 'new_review';
  message: string;
  timestamp: string;
}

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
    const token = getAccessToken();
    if (!token) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(`/api/v1/admin/notifications/stream?token=${encodeURIComponent(token)}`);

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
      });

      es.addEventListener('error', () => {
        setConnected(false);
        es?.close();
        retryTimeout = setTimeout(connect, 5000);
      });
    };

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, []);

  return { notifications, connected, dismiss, dismissAll };
}
