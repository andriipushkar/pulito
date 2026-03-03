'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'Невалідне посилання для верифікації');

  useEffect(() => {
    if (!token) return;

    fetch('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setMessage('Ваш email успішно підтверджено!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Помилка верифікації');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Помилка мережі');
      });
  }, [token]);

  return (
    <div className="text-center">
      {status === 'loading' && (
        <>
          <div className="mb-4 flex justify-center">
            <Spinner size="lg" />
          </div>
          <h1 className="text-2xl font-bold">Підтвердження email...</h1>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="mb-4 text-5xl">✓</div>
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-success)]">Успішно!</h1>
          <p className="mb-6 text-[var(--color-text-secondary)]">{message}</p>
          <Link
            href="/auth/login"
            className="rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)]"
          >
            Увійти
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="mb-4 text-5xl text-[var(--color-danger)]">✕</div>
          <h1 className="mb-4 text-2xl font-bold text-[var(--color-danger)]">Помилка</h1>
          <p className="mb-6 text-[var(--color-text-secondary)]">{message}</p>
          <Link
            href="/auth/login"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Повернутись до входу
          </Link>
        </>
      )}
    </div>
  );
}
