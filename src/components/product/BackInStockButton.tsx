'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

interface Props {
  productId: number;
}

/**
 * Shown on out-of-stock products instead of "Add to cart".
 * Lets visitors leave their email to be notified when stock returns.
 */
export default function BackInStockButton({ productId }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubscribe = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Введіть коректний email');
      return;
    }
    setBusy(true);
    const res = await apiClient.post<{ subscribed: boolean }>(
      '/api/v1/products/back-in-stock',
      { productId, email: email.trim() },
    );
    setBusy(false);
    if (res.success) {
      setDone(true);
      toast.success('Ми сповістимо вас, коли товар з\'явиться');
    } else {
      toast.error(res.error || 'Не вдалося оформити підписку');
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium">Ми напишемо на {email}, коли товар з&apos;явиться</span>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-5 py-3 text-sm font-semibold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/10"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        Сповістити, коли з&apos;явиться
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-3">
      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
        Залиште email — ми сповістимо одразу як товар знову з&apos;явиться на складі
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
          placeholder="your@email.com"
          autoFocus
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={busy}
          className="shrink-0 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
        >
          {busy ? '…' : 'Підписатися'}
        </button>
      </div>
    </div>
  );
}
