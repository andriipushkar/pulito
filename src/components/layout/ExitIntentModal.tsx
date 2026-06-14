'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import SubscriptionForm from './SubscriptionForm';

// Exit-intent newsletter capture (desktop only — mobile has no cursor to
// leave with). Deliberately conservative so it never feels pushy:
//   - fires once per 30 days per browser (localStorage)
//   - never within the first 20s of the visit
//   - never on checkout/cart/account flows (don't interrupt a purchase)
const STORAGE_KEY = 'exit_intent_shown_at';
const REPEAT_AFTER_DAYS = 30;
const MIN_DWELL_MS = 20_000;
const EXCLUDED_PREFIXES = ['/checkout', '/cart', '/account', '/auth', '/order-success'];

export default function ExitIntentModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return;

    let shownAt = 0;
    try {
      shownAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
    } catch {
      return; // storage blocked — skip rather than risk showing every visit
    }
    if (Date.now() - shownAt < REPEAT_AFTER_DAYS * 24 * 60 * 60 * 1000) return;

    const arrivedAt = Date.now();
    const onMouseLeave = (e: MouseEvent) => {
      // Top-edge exit only (heading for the tab bar / URL bar), after dwell.
      if (e.clientY > 0 || Date.now() - arrivedAt < MIN_DWELL_MS) return;
      document.removeEventListener('mouseleave', onMouseLeave);
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* best-effort */
      }
      setOpen(true);
    };
    document.addEventListener('mouseleave', onMouseLeave);
    return () => document.removeEventListener('mouseleave', onMouseLeave);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-heading"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[var(--color-primary-light)] p-6 text-white shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Закрити"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none text-white transition-colors hover:bg-white/30"
        >
          ×
        </button>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Зачекайте!
        </span>
        <h2 id="exit-intent-heading" className="mt-3 text-2xl font-extrabold leading-tight">
          −10% на перше замовлення
        </h2>
        <p className="mt-2 text-sm text-white/85">
          Підпишіться на новини — і отримайте промокод на знижку, ранній доступ до акцій та новинок.
        </p>
        <div className="mt-5">
          <SubscriptionForm variant="light" />
        </div>
      </div>
    </div>
  );
}
