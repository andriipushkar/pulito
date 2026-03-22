'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { apiClient } from '@/lib/api-client';

interface AddBundleToCartButtonProps {
  slug: string;
}

export default function AddBundleToCartButton({ slug }: AddBundleToCartButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const handleAddToCart = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/api/v1/bundles/${slug}/add-to-cart`);
      if (res.success) {
        setMessage({ type: 'success', text: 'Комплект додано до кошика!' });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: res.error || 'Не вдалося додати до кошика' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Не вдалося додати до кошика' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={handleAddToCart}
        isLoading={isLoading}
        size="lg"
        className="w-full"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        Додати комплект до кошика
      </Button>

      {message && (
        <p className={`mt-3 text-center text-sm font-medium ${message.type === 'success' ? 'text-[#4CAF50]' : 'text-[var(--color-danger)]'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
