'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

export default function PaymentRedirectPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>(orderId ? 'loading' : 'error');
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    if (!orderId) return;

    const checkPayment = async () => {
      const res = await apiClient.get<{
        paymentStatus: string;
        order?: { orderNumber: string };
      }>(`/api/v1/orders/${orderId}`);

      if (res.success && res.data) {
        setOrderNumber(
          (res.data as unknown as { orderNumber?: string }).orderNumber || orderId
        );
        const paymentStatus = (res.data as unknown as { paymentStatus?: string }).paymentStatus;
        if (paymentStatus === 'paid') {
          setStatus('success');
        } else {
          setStatus('pending');
        }
      } else {
        setStatus('error');
      }
    };

    checkPayment();
  }, [orderId]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-[var(--color-text-secondary)]">Перевіряємо статус оплати...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {status === 'success' && (
        <>
          <div className="mb-4 text-5xl">&#10003;</div>
          <h1 className="mb-2 text-2xl font-bold text-green-600">Оплата пройшла успішно!</h1>
          <p className="mb-6 text-[var(--color-text-secondary)]">
            Замовлення #{orderNumber} оплачено. Дякуємо за покупку!
          </p>
        </>
      )}

      {status === 'pending' && (
        <>
          <div className="mb-4 text-5xl">&#8987;</div>
          <h1 className="mb-2 text-2xl font-bold text-yellow-600">Очікування підтвердження</h1>
          <p className="mb-6 text-[var(--color-text-secondary)]">
            Статус оплати замовлення #{orderNumber} ще обробляється. Зазвичай це займає кілька хвилин.
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="mb-4 text-5xl">&#10007;</div>
          <h1 className="mb-2 text-2xl font-bold text-red-600">Помилка</h1>
          <p className="mb-6 text-[var(--color-text-secondary)]">
            Не вдалося перевірити статус оплати. Зверніться до підтримки.
          </p>
        </>
      )}

      <div className="flex justify-center gap-4">
        <Link
          href="/account/orders"
          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Мої замовлення
        </Link>
        <Link
          href="/"
          className="rounded-[var(--radius)] border border-[var(--color-border)] px-6 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)]"
        >
          На головну
        </Link>
      </div>
    </div>
  );
}
