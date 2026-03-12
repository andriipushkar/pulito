'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-reload when connection is restored
  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto max-w-sm">
        <svg
          className="mx-auto mb-6 h-16 w-16 text-[var(--color-text-secondary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M8.464 15.536a5 5 0 010-7.072M15.536 8.464a5 5 0 010 7.072M12 12h.01"
          />
        </svg>

        {isOnline ? (
          <>
            <h1 className="mb-2 text-xl font-bold text-[var(--color-success)]">
              З&apos;єднання відновлено
            </h1>
            <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
              Сторінка оновиться автоматично...
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold text-[var(--color-text)]">
              Немає з&apos;єднання з інтернетом
            </h1>
            <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
              Перевірте підключення до мережі. Деякі раніше переглянуті сторінки доступні офлайн.
            </p>
          </>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] active:scale-[0.97]"
          >
            Спробувати знову
          </button>
          <Link
            href="/catalog"
            className="w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            Переглянути каталог (офлайн)
          </Link>
          <Link
            href="/"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            На головну
          </Link>
        </div>
      </div>
    </div>
  );
}
