'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { apiClient } from '@/lib/api-client';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Щотижня' },
  { value: 'biweekly', label: 'Кожні 2 тижні' },
  { value: 'monthly', label: 'Щомісяця' },
  { value: 'bimonthly', label: 'Кожні 2 місяці' },
];

interface SubscribeButtonProps {
  productId: number;
  productName: string;
  className?: string;
}

export default function SubscribeButton({ productId, productName, className = '' }: SubscribeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/api/v1/me/subscriptions', {
        frequency,
        items: [{ productId, quantity }],
      });

      if (res.success) {
        setMessage({ type: 'success', text: 'Підписку створено!' });
        setTimeout(() => {
          setIsOpen(false);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: 'error', text: res.error || 'Не вдалося створити підписку' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Не вдалося створити підписку' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-primary)]/30 px-4 py-2 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/5 ${className}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
        </svg>
        Підписатися та зекономити
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Створити підписку" size="sm">
        <div className="p-6">
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Оформіть регулярну доставку товару <strong className="text-[var(--color-text)]">{productName}</strong> та заощаджуйте на кожному замовленні.
          </p>

          <div className="mb-4">
            <Select
              label="Частота доставки"
              options={FREQUENCY_OPTIONS}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="subscribe-qty" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Кількість
            </label>
            <input
              id="subscribe-qty"
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value))))}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          {message && (
            <p className={`mb-4 text-center text-sm font-medium ${message.type === 'success' ? 'text-[#4CAF50]' : 'text-[var(--color-danger)]'}`}>
              {message.text}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              Скасувати
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              isLoading={isLoading}
              onClick={handleSubscribe}
            >
              Підписатися
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
