'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash } from '@/components/icons';
import QuantitySelector from '@/components/product/QuantitySelector';
import type { CartItem } from '@/providers/CartProvider';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
}

export default function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const subtotal = item.priceRetail * item.quantity;

  // Swipe-to-delete state
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const SWIPE_THRESHOLD = 80;
  const REMOVE_THRESHOLD = 160;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    // Only allow left swipe, cap at REMOVE_THRESHOLD * 1.2
    const clamped = Math.max(0, Math.min(diff, REMOVE_THRESHOLD * 1.2));
    setSwipeOffset(clamped);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (swipeOffset >= REMOVE_THRESHOLD) {
      // Animate out and remove
      setSwipeOffset(500);
      setTimeout(() => onRemove(item.productId), 200);
    } else if (swipeOffset >= SWIPE_THRESHOLD) {
      // Snap to reveal delete button
      setSwipeOffset(SWIPE_THRESHOLD);
    } else {
      setSwipeOffset(0);
    }
  };

  return (
    <div className="relative overflow-hidden border-b border-[var(--color-border)] last:border-0">
      {/* Delete background (revealed on swipe) */}
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-[var(--color-danger)] text-white sm:hidden">
        <button
          onClick={() => onRemove(item.productId)}
          className="flex flex-col items-center gap-1"
          aria-label="Видалити"
        >
          <Trash size={20} />
          <span className="text-[10px] font-medium">Видалити</span>
        </button>
      </div>

      {/* Main content (slides on swipe) */}
      <div
        className="relative flex gap-4 bg-[var(--color-bg)] py-4"
        style={{
          transform: `translateX(-${swipeOffset}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Image */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius)] bg-[var(--color-bg-secondary)]">
          {item.imagePath ? (
            <Image src={item.imagePath} alt={item.name} fill className="object-cover" sizes="80px" />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex-1">
            <Link
              href={`/product/${item.slug}`}
              className="text-sm font-medium hover:text-[var(--color-primary)]"
            >
              {item.name}
            </Link>
            <p className="text-xs text-[var(--color-text-secondary)]">Код: {item.code}</p>
            <p className="mt-1 text-sm font-semibold sm:hidden">{item.priceRetail.toFixed(2)} ₴</p>
          </div>

          {/* Price (desktop) */}
          <div className="hidden w-24 text-right sm:block">
            <span className="text-sm font-medium">{item.priceRetail.toFixed(2)} ₴</span>
          </div>

          {/* Quantity */}
          <QuantitySelector
            value={item.quantity}
            onChange={(qty) => onUpdateQuantity(item.productId, qty)}
            max={item.maxQuantity}
            className="self-start"
          />

          {/* Subtotal */}
          <div className="hidden w-28 text-right sm:block">
            <span className="text-sm font-bold">{subtotal.toFixed(2)} ₴</span>
          </div>

          {/* Remove (desktop only — mobile uses swipe) */}
          <button
            onClick={() => onRemove(item.productId)}
            className="hidden self-start rounded-[var(--radius)] p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-danger)] sm:block"
            aria-label="Видалити"
          >
            <Trash size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
