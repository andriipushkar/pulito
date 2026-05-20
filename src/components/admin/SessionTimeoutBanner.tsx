'use client';

import { useEffect, useState } from 'react';
import { getAccessToken, apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * Reads the JWT's `exp` claim (no verification — server is source of truth)
 * and surfaces a banner when the session has ≤5 min left. Tries refreshing
 * the token automatically on user click. We don't auto-refresh in the
 * background because long-idle admins should re-authenticate explicitly.
 */
function decodeExpClaim(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

const WARN_THRESHOLD_SECONDS = 5 * 60;

export default function SessionTimeoutBanner() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    const tick = () => {
      const token = getAccessToken();
      if (!token) {
        setSecondsLeft(null);
        return;
      }
      const exp = decodeExpClaim(token);
      if (!exp) {
        setSecondsLeft(null);
        return;
      }
      const left = exp - Math.floor(Date.now() / 1000);
      setSecondsLeft(left);
    };
    tick();
    const interval = setInterval(tick, 15_000);
    return () => clearInterval(interval);
  }, []);

  const handleExtend = async () => {
    setExtending(true);
    const res = await apiClient.post<{ accessToken: string }>('/api/v1/auth/refresh', {});
    setExtending(false);
    if (res.success) {
      toast.success('Сесію продовжено');
      // accessToken state inside api-client gets updated by the route handler
      // via Set-Cookie; force re-decode on next tick.
    } else {
      // Refresh failed — redirect to login so user does not think the session was extended.
      toast.error('Не вдалося продовжити сесію — увійдіть повторно');
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname : '/admin';
      window.location.assign(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  };

  if (secondsLeft === null || secondsLeft > WARN_THRESHOLD_SECONDS) return null;
  if (secondsLeft <= 0) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
        <span aria-hidden="true">🔒</span>
        <p className="flex-1 text-sm font-medium text-red-800">
          Сесія завершена. Збережіть незавершену роботу та увійдіть знову.
        </p>
        <a
          href="/auth/login?returnUrl=/admin"
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Увійти
        </a>
      </div>
    );
  }

  const minutes = Math.ceil(secondsLeft / 60);
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span aria-hidden="true">⏱️</span>
      <p className="flex-1 text-sm font-medium text-amber-800">
        Сесія закінчиться через {minutes} хв. Збережіть зміни або продовжіть сесію.
      </p>
      <button
        type="button"
        onClick={handleExtend}
        disabled={extending}
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {extending ? 'Продовжуємо…' : 'Продовжити'}
      </button>
    </div>
  );
}
