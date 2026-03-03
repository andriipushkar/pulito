'use client';

import { useEffect, useState } from 'react';
import { Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';

interface FloatingBuyBarProps {
  productId: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: number;
  priceWholesale: number | null;
  imagePath: string | null;
  quantity: number;
}

export default function FloatingBuyBar({
  productId,
  name,
  slug,
  code,
  priceRetail,
  priceWholesale,
  imagePath,
  quantity,
}: FloatingBuyBarProps) {
  const { addItem } = useCart();
  const [visible, setVisible] = useState(false);
  const inStock = quantity > 0;

  useEffect(() => {
    const handleScroll = () => {
      const addToCartBtn = document.querySelector('[data-add-to-cart]');
      if (!addToCartBtn) {
        setVisible(window.scrollY > 400);
        return;
      }
      const rect = addToCartBtn.getBoundingClientRect();
      setVisible(rect.bottom < 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!inStock) return null;

  const handleAdd = () => {
    addItem({
      productId,
      name,
      slug,
      code,
      priceRetail,
      priceWholesale,
      imagePath,
      quantity: 1,
      maxQuantity: quantity,
    });
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 shadow-[var(--shadow-lg)] transition-transform duration-300 md:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg font-bold">{priceRetail.toFixed(2)} ₴</span>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          <Cart size={18} />
          В кошик
        </button>
      </div>
    </div>
  );
}
