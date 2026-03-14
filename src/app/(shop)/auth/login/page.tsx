'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Невірний формат email'),
  password: z.string().min(1, 'Введіть пароль'),
});

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const res = await login(email, password);
    setIsLoading(false);

    if (res.success) {
      const returnUrl = searchParams.get('returnUrl') || '/';
      router.push(returnUrl);
    } else {
      setGeneralError(res.error || 'Помилка входу');
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-center text-2xl font-bold">Вхід</h1>

      {generalError && (
        <div className="mb-4 rounded-[var(--radius)] bg-red-50 p-3 text-sm text-[var(--color-danger)]">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="your@email.com"
          autoComplete="email"
        />
        <Input
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          placeholder="Введіть пароль"
          autoComplete="current-password"
        />

        <div className="text-right">
          <Link href="/auth/forgot-password" className="text-sm text-[var(--color-primary)] hover:underline">
            Забули пароль?
          </Link>
        </div>

        <Button type="submit" isLoading={isLoading} className="w-full">
          Увійти
        </Button>
      </form>

      <div className="relative my-6 flex items-center">
        <div className="flex-1 border-t border-[var(--color-border)]" />
        <span className="px-3 text-sm text-[var(--color-text-secondary)]">або</span>
        <div className="flex-1 border-t border-[var(--color-border)]" />
      </div>

      <a
        href="/api/v1/auth/google"
        className="flex w-full items-center justify-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335"/>
        </svg>
        Увійти через Google
      </a>

      <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Немає акаунту?{' '}
        <Link href="/auth/register" className="text-[var(--color-primary)] hover:underline">
          Зареєструватись
        </Link>
      </div>
    </div>
  );
}
