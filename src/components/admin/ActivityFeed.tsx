'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';

interface ActivityEvent {
  type: 'order_created' | 'status_changed';
  id: string;
  message: string;
  href: string;
  at: string | Date;
}

const ICONS: Record<ActivityEvent['type'], string> = {
  order_created: '📦',
  status_changed: '🔄',
};

export default function ActivityFeed() {
  const t = useTranslations('admin.activityFeed');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { notifications } = useAdminNotifications();

  useEffect(() => {
    apiClient
      .get<ActivityEvent[]>('/api/v1/admin/dashboard/activity')
      .then((res) => {
        if (res.success && res.data) setEvents(res.data);
      })
      // Always clear the loading flag — without `.finally`, a rejected promise
      // (network blip, 5xx) would leave isLoading=true forever and the widget
      // would silently never render.
      .finally(() => setIsLoading(false));
  }, []);

  // Optimistically prepend live SSE notifications. The next API fetch will
  // bring the canonical row. Derive instead of storing — no setState in effect.
  const displayedEvents = useMemo(() => {
    if (notifications.length === 0) return events;
    // Dedupe within `notifications` themselves: SSE can deliver the same id
    // twice on reconnect, which would create duplicate React keys.
    const seenLiveIds = new Set<string>();
    const live = [] as ActivityEvent[];
    for (const n of notifications.slice(0, 3)) {
      const id = `live-${n.id}`;
      if (seenLiveIds.has(id)) continue;
      seenLiveIds.add(id);
      live.push({
        type: 'order_created' as const,
        id,
        message: n.message,
        href: '/admin/orders',
        at: n.timestamp,
      });
    }
    const seen = new Set(events.map((p) => p.id));
    const fresh = live.filter((l) => !seen.has(l.id));
    return [...fresh, ...events].slice(0, 30);
  }, [events, notifications]);

  // Self-hide when loading or when there are no events at all — don't show
  // a giant empty placeholder card on the dashboard.
  if (isLoading || displayedEvents.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <span className="text-[10px] text-[var(--color-text-secondary)]">{t('last20')}</span>
      </div>
      {displayedEvents.length === 0 ? null : (
        <ul className="max-h-96 space-y-1.5 overflow-y-auto">
          {displayedEvents.map((ev) => (
            <li key={ev.id}>
              <Link
                href={ev.href}
                className="flex items-start gap-2 rounded-md p-1.5 text-xs hover:bg-[var(--color-bg-secondary)]"
              >
                <span className="text-base">{ICONS[ev.type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{ev.message}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {new Date(ev.at).toLocaleString('uk-UA', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
