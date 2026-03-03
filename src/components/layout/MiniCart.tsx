'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Trash, Plus, Minus } from '@/components/icons';

interface MiniCartProps {
  onClose: () => void;
}

export default function MiniCart({ onClose }: MiniCartProps) {
  const { items, total, removeItem, updateQuantity } = useCart();
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const cartTotal = total(user?.role);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Кошик"
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-xl)]"
    >
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-[var(--color-text-secondary)]">
          Кошик порожній
        </div>
      ) : (
        <>
          <div className="max-h-64 overflow-auto p-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 border-b border-[var(--color-border)] py-2 last:border-0">
                {item.imagePath ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.imagePath} alt={item.name} className="h-12 w-12 shrink-0 rounded object-contain bg-[var(--color-bg-secondary)]" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded bg-[var(--color-bg-secondary)]" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/product/${item.slug}`}
                    className="block truncate text-sm font-medium hover:text-[var(--color-primary)]"
                    onClick={onClose}
                  >
                    {item.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                      className="rounded border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]"
                      aria-label="Зменшити"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-xs font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="rounded border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]"
                      aria-label="Збільшити"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      x {Number(item.priceRetail).toFixed(2)} ₴
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="shrink-0 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                  aria-label="Видалити"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--color-border)] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Разом:</span>
              <span className="text-lg font-bold">{cartTotal.toFixed(2)} ₴</span>
            </div>
            <div className="flex gap-2">
              <Link
                href="/cart"
                onClick={onClose}
                className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] py-2 text-center text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)]"
              >
                Кошик
              </Link>
              <Link
                href="/checkout"
                onClick={onClose}
                className="flex-1 rounded-[var(--radius)] bg-[var(--color-primary)] py-2 text-center text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
              >
                Оформити
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
