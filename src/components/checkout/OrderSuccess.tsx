'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Check } from '@/components/icons';
import Button from '@/components/ui/Button';
import { apiClient } from '@/lib/api-client';

interface GuestContact {
  email: string;
  fullName: string;
  phone: string;
}

interface OrderSuccessProps {
  orderNumber: string;
  guestContact?: GuestContact;
}

export default function OrderSuccess({ orderNumber, guestContact }: OrderSuccessProps) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <Check size={32} className="text-green-600" />
      </div>
      <h2 className="mb-2 text-2xl font-bold">Замовлення оформлене!</h2>
      <p className="mb-1 text-[var(--color-text-secondary)]">
        Номер замовлення: <strong>{orderNumber}</strong>
      </p>
      <p className="mb-8 max-w-md text-sm text-[var(--color-text-secondary)]">
        Ми надішлемо підтвердження на вашу електронну пошту. Менеджер зв&apos;яжеться з вами для
        уточнення деталей.
      </p>

      {guestContact && <GuestAccountPrompt contact={guestContact} />}

      <div className="flex gap-3">
        <Link href="/account/orders">
          <Button variant="outline">Мої замовлення</Button>
        </Link>
        <Link href="/catalog">
          <Button>Продовжити покупки</Button>
        </Link>
      </div>
    </div>
  );
}

function GuestAccountPrompt({ contact }: { contact: GuestContact }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (success) {
    return (
      <div className="mb-8 w-full max-w-md rounded-[var(--radius)] border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
        <p className="text-sm font-medium">
          ✓ Акаунт створено. Ви автоматично увійшли — наступне замовлення оформите швидше.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Пароль має бути мінімум 8 символів');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post<{ user: unknown; accessToken: string }>(
        '/api/v1/auth/register',
        {
          email: contact.email,
          password,
          fullName: contact.fullName || contact.email.split('@')[0],
          phone: contact.phone || undefined,
        },
      );
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Не вдалося створити акаунт');
      }
    } catch {
      setError('Помилка мережі. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-left"
    >
      <p className="mb-1 text-sm font-semibold">🎁 Створити акаунт одним кліком</p>
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        Email <strong>{contact.email}</strong> вже введений. Задайте пароль — і наступне замовлення
        оформите швидше + ви побачите статус доставки тут.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль (мін. 8 символів)"
          className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        />
        <Button type="submit" isLoading={submitting} className="sm:w-auto">
          Створити
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </form>
  );
}
