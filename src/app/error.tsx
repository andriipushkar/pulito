'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, Phone } from '@/components/icons';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Error boundary]', error);
    // Sentry: dynamic import to avoid build failure when @sentry/nextjs is not installed
    import('@/lib/sentry').then((m) => m.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="mb-2 text-4xl font-bold text-[var(--color-danger)]">Помилка</h1>
      <p className="mb-6 text-[var(--color-text-secondary)]">
        {error.message || 'Щось пішло не так'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-3 text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Спробувати знову
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-6 py-3 transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          <Home size={18} />
          На головну
        </Link>
        <a
          href="mailto:info@poroshok.ua"
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-6 py-3 text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          <Phone size={18} />
          Звʼязатися з підтримкою
        </a>
      </div>
    </main>
  );
}
