'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { useCart } from '@/hooks/useCart';
import { gtagEvent } from '@/lib/gtag';

export interface BundleCartItemInput {
  productId: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: number;
  priceWholesale: number | null;
  priceWholesale2: number | null;
  priceWholesale3: number | null;
  imagePath: string | null;
  /** Скільки одиниць входить у комплект. */
  quantity: number;
  /** Поточний залишок на складі. */
  maxQuantity: number;
}

interface AddBundleToCartButtonProps {
  items: BundleCartItemInput[];
}

// Додаємо позиції комплекту через клієнтський кошик (useCart.addItem) — той
// самий шлях, що й звичайна кнопка «В кошик»: працює і для гостей
// (localStorage), і для залогінених (синк на чекауті). Стара версія била в
// server-only роут з withAuth, тож гість отримував 401. Бандл-знижку нараховує
// сервер у createOrder, тут лише наповнюємо кошик.
export default function AddBundleToCartButton({ items }: AddBundleToCartButtonProps) {
  const { addItem } = useCart();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddToCart = () => {
    setMessage(null);

    const outOfStock = items.find((item) => item.maxQuantity < item.quantity);
    if (outOfStock) {
      setMessage({
        type: 'error',
        text: `Недостатньо «${outOfStock.name}» на складі — комплект тимчасово недоступний`,
      });
      return;
    }

    for (const item of items) {
      addItem({
        productId: item.productId,
        name: item.name,
        slug: item.slug,
        code: item.code,
        priceRetail: item.priceRetail,
        priceWholesale: item.priceWholesale,
        priceWholesale2: item.priceWholesale2,
        priceWholesale3: item.priceWholesale3,
        imagePath: item.imagePath,
        quantity: item.quantity,
        maxQuantity: item.maxQuantity,
      });
      gtagEvent.addToCart({
        item_id: item.code || String(item.productId),
        item_name: item.name,
        price: item.priceRetail,
        quantity: item.quantity,
      });
    }

    setMessage({ type: 'success', text: 'Комплект додано до кошика!' });
    toast.success('Комплект додано до кошика');
  };

  return (
    <div>
      <Button onClick={handleAddToCart} size="lg" className="w-full">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
        Додати комплект до кошика
      </Button>

      {message && (
        <p
          className={`mt-3 text-center text-sm font-medium ${message.type === 'success' ? 'text-[#4CAF50]' : 'text-[var(--color-danger)]'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
