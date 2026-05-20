'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { z } from 'zod';

const PASSWORD_HINT =
  'Мінімум 8 символів, велика та мала літера, цифра і спецсимвол (!@#$…)';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Мінімум 8 символів')
      .max(128, 'Максимум 128 символів')
      .refine(
        (val) =>
          /[A-Z]/.test(val) &&
          /[a-z]/.test(val) &&
          /\d/.test(val) &&
          /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/]/.test(val),
        { message: PASSWORD_HINT },
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Паролі не збігаються',
    path: ['confirmPassword'],
  });

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    const result = schema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!token) {
      setGeneralError('Невалідне посилання');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setGeneralError(data.error || 'Помилка скидання пароля');
      }
    } catch {
      setGeneralError('Помилка мережі');
    }
    setIsLoading(false);
  };

  if (success) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">Пароль змінено</h1>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Тепер ви можете увійти з новим паролем.
        </p>
        <Link
          href="/auth/login"
          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)]"
        >
          Увійти
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-center text-2xl font-bold">Новий пароль</h1>

      {generalError && (
        <div className="mb-4 rounded-[var(--radius)] bg-red-50 p-3 text-sm text-[var(--color-danger)]">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Input
            label="Новий пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            placeholder="Мінімум 8 символів"
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{PASSWORD_HINT}</p>
        </div>
        <Input
          label="Підтвердження пароля"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          placeholder="Повторіть пароль"
          autoComplete="new-password"
        />
        <Button type="submit" isLoading={isLoading} className="w-full">
          Зберегти пароль
        </Button>
      </form>
    </div>
  );
}
