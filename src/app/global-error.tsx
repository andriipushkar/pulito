'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global error boundary]', error);
    import('@/lib/sentry').then((m) => m.captureException(error)).catch(() => {});
  }, [error]);

  return (
    <html lang="uk">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          background: '#fafafa',
          color: '#1a1a1a',
        }}
      >
        <main
          style={{
            maxWidth: 480,
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 32, color: '#dc2626' }}>Критична помилка</h1>
          <p style={{ margin: '0 0 24px', color: '#525252' }}>
            {error.message ||
              'Сталася непередбачувана помилка. Спробуйте перезавантажити сторінку.'}
          </p>
          {error.digest ? (
            <p style={{ margin: '0 0 24px', fontSize: 12, color: '#a3a3a3' }}>
              Код помилки: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: '12px 24px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Спробувати знову
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: '12px 24px',
                background: '#fff',
                color: '#1a1a1a',
                border: '1px solid #d4d4d4',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              На головну
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
