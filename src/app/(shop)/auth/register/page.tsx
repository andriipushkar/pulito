'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import PhoneInput, { cleanPhone } from '@/components/ui/PhoneInput';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Мінімум 2 символи'),
  email: z.string().email('Невірний формат email'),
  password: z.string().min(8, 'Мінімум 8 символів'),
  phone: z.string().optional(),
  companyName: z.string().max(200, 'Максимум 200 символів').optional(),
  edrpou: z
    .string()
    .regex(/^\d{8}$/, 'ЄДРПОУ має містити рівно 8 цифр')
    .optional()
    .or(z.literal('')),
});

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    companyName: '',
    edrpou: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCompany, setShowCompany] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    const result = registerSchema.safeParse(form);
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
    const res = await register({
      email: form.email,
      password: form.password,
      fullName: form.fullName,
      phone: form.phone || undefined,
      companyName: form.companyName || undefined,
      edrpou: form.edrpou || undefined,
    });
    setIsLoading(false);

    if (res.success) {
      router.push('/auth/login?registered=true');
    } else {
      setGeneralError(res.error || 'Помилка реєстрації');
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-center text-2xl font-bold">Реєстрація</h1>

      {generalError && (
        <div className="mb-4 rounded-[var(--radius)] bg-red-50 p-3 text-sm text-[var(--color-danger)]">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="ПІБ"
          value={form.fullName}
          onChange={(e) => handleChange('fullName', e.target.value)}
          error={errors.fullName}
          placeholder="Іванов Іван Іванович"
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          placeholder="your@email.com"
          autoComplete="email"
        />
        <Input
          label="Пароль"
          type="password"
          value={form.password}
          onChange={(e) => handleChange('password', e.target.value)}
          error={errors.password}
          placeholder="Мінімум 8 символів"
          autoComplete="new-password"
        />
        <PhoneInput
          label="Телефон (опційно)"
          value={form.phone}
          onChange={(e) => handleChange('phone', cleanPhone(e.target.value))}
          error={errors.phone}
          autoComplete="tel"
        />

        {/* Company fields collapsible */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setShowCompany((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
          >
            <span>Для юридичних осіб</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`shrink-0 transition-transform ${showCompany ? 'rotate-180' : ''}`}
            >
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showCompany && (
            <div className="flex flex-col gap-4 border-t border-[var(--color-border)] px-4 pb-4 pt-3">
              <Input
                label="Назва компанії"
                value={form.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                error={errors.companyName}
                placeholder="ТОВ «Назва»"
                autoComplete="organization"
              />
              <Input
                label="ЄДРПОУ"
                value={form.edrpou}
                onChange={(e) => handleChange('edrpou', e.target.value)}
                error={errors.edrpou}
                placeholder="12345678"
                maxLength={8}
              />
            </div>
          )}
        </div>

        <Button type="submit" isLoading={isLoading} className="w-full">
          Зареєструватись
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
        Зареєструватись через Google
      </a>

      <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Вже маєте акаунт?{' '}
        <Link href="/auth/login" className="text-[var(--color-primary)] hover:underline">
          Увійти
        </Link>
      </div>
    </div>
  );
}
