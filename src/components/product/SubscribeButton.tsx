'use client';

import { useState, useRef, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreateSubscription } from '@/hooks/useSubscription';

const DISCOUNT_PERCENT = 5;

const FREQUENCY_OPTIONS = [
  { value: 'weekly' as const, label: 'Щотижня (7 днів)' },
  { value: 'biweekly' as const, label: 'Раз на 2 тижні (14 днів)' },
  { value: 'monthly' as const, label: 'Щомісяця (30 днів)' },
  { value: 'bimonthly' as const, label: 'Раз на 2 місяці (60 днів)' },
];

interface SubscribeButtonProps {
  productId: number;
  productName: string;
  price: number;
}

export default function SubscribeButton({ productId, productName, price }: SubscribeButtonProps) {
  const { user } = useAuth();
  const { createSubscription } = useCreateSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const discountedPrice = price * (1 - DISCOUNT_PERCENT / 100);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowLoginPrompt(false);
      }
    }
    if (isOpen || showLoginPrompt) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, showLoginPrompt]);

  const handleToggle = () => {
    if (!user) {
      setShowLoginPrompt(true);
      setIsOpen(false);
      return;
    }
    setShowLoginPrompt(false);
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsOpen(!isOpen);
  };

  const handleSelectFrequency = async (
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly',
  ) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await createSubscription({
        frequency,
        items: [{ productId, quantity: 1 }],
      });
      if (res.success) {
        setSuccessMessage('Підписку створено!');
        setIsOpen(false);
      } else {
        setErrorMessage(res.error || 'Не вдалося створити підписку');
      }
    } catch {
      setErrorMessage('Не вдалося створити підписку');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        data-subscribe-button
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-green-500 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition-all hover:bg-green-100 active:scale-[0.98]"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992"
          />
        </svg>
        <span>Підписатись та заощадити {DISCOUNT_PERCENT}%</span>
        <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
          -{DISCOUNT_PERCENT}%
        </span>
      </button>

      {/* Login prompt */}
      {showLoginPrompt && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-lg">
          <p className="mb-3 text-sm text-[var(--color-text)]">
            Увійдіть в акаунт, щоб оформити підписку
          </p>
          <Link
            href="/auth/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)]"
          >
            Увійти
          </Link>
        </div>
      )}

      {/* Frequency dropdown */}
      {isOpen && (
        <div
          data-frequency-dropdown
          className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg"
        >
          <div className="border-b border-[var(--color-border)]/60 px-4 py-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Оберіть частоту доставки
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{productName}</p>
          </div>

          <div className="divide-y divide-[var(--color-border)]/40">
            {FREQUENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSelectFrequency(option.value)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
              >
                <span className="text-sm text-[var(--color-text)]">{option.label}</span>
                <span className="text-sm font-semibold text-green-600">
                  {discountedPrice.toFixed(2)} ₴
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--color-border)]/60 bg-[var(--color-bg-secondary)]/40 px-4 py-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Звичайна ціна: <span className="line-through">{price.toFixed(2)} ₴</span>{' '}
              <span className="font-semibold text-green-600">
                Економія: {(price - discountedPrice).toFixed(2)} ₴
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <p className="mt-2 text-sm font-medium text-green-600">{successMessage}</p>
      )}

      {/* Error message */}
      {errorMessage && <p className="mt-2 text-sm font-medium text-red-600">{errorMessage}</p>}
    </div>
  );
}
