'use client';

import { useState } from 'react';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Невірний формат email'),
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = schema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After'));
        const minutes = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.max(1, Math.ceil(retryAfter / 60))
          : 15;
        setError(
          `Забагато спроб. Спробуйте за ${minutes} хв або зверніться у підтримку.`,
        );
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Не вдалося надіслати лист. Спробуйте пізніше.');
        setIsLoading(false);
        return;
      }
    } catch {
      setError('Помилка мережі. Перевірте зʼєднання і спробуйте ще раз.');
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">Перевірте пошту</h1>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Якщо акаунт з email <strong>{email}</strong> існує, ми надіслали лист із інструкціями для
          відновлення пароля.
        </p>
        <Link href="/auth/login" className="text-sm text-[var(--color-primary)] underline">
          Повернутись до входу
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-center text-2xl font-bold">Забули пароль?</h1>
      <p className="mb-6 text-center text-sm text-[var(--color-text-secondary)]">
        Введіть ваш email і ми надішлемо інструкції для відновлення
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          placeholder="your@email.com"
          autoComplete="email"
        />
        <Button type="submit" isLoading={isLoading} className="w-full">
          Відновити пароль
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/auth/login" className="text-sm text-[var(--color-primary)] underline">
          Повернутись до входу
        </Link>
      </div>
    </div>
  );
}
