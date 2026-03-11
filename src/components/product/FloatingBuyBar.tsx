'use client';

import { useEffect, useState } from 'react';
import { Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { resolveWholesalePrice } from '@/lib/wholesale-price';

interface FloatingBuyBarProps {
  productId: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: number;
  priceWholesale: number | null;
  priceWholesale2?: number | null;
  priceWholesale3?: number | null;
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
  priceWholesale2,
  priceWholesale3,
  imagePath,
  quantity,
}: FloatingBuyBarProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
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
      priceWholesale: resolveWholesalePrice({ priceWholesale, priceWholesale2, priceWholesale3 }, user?.wholesaleGroup) ?? priceWholesale,
      imagePath,
      quantity: 1,
      maxQuantity: quantity,
    });
  };

  return (
    <div
      className={`fixed inset-x-0 z-30 px-3 transition-all duration-300 md:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
      style={{ bottom: 'calc(68px + max(env(safe-area-inset-bottom, 0px), 8px))' }}
    >
      <div className="glass-nav mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-white/30 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
        <div className="min-w-0">
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{name}</p>
          <span className="text-base font-bold text-[var(--color-text)]">{priceRetail.toFixed(2)} ₴</span>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition-all active:scale-95"
        >
          <Cart size={16} />
          В кошик
        </button>
      </div>
    </div>
  );
}
