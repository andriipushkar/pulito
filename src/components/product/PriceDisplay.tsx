'use client';

import { useAuth } from '@/hooks/useAuth';
import { resolveWholesalePrice } from '@/lib/wholesale-price';

interface PriceDisplayProps {
  priceRetail: string | number;
  priceWholesale?: string | number | null;
  priceWholesale2?: string | number | null;
  priceWholesale3?: string | number | null;
  priceRetailOld?: string | number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: { current: 'text-sm', old: 'text-xs' },
  md: { current: 'text-lg', old: 'text-sm' },
  lg: { current: 'text-2xl', old: 'text-base' },
};

export default function PriceDisplay({
  priceRetail,
  priceWholesale,
  priceWholesale2,
  priceWholesale3,
  priceRetailOld,
  size = 'md',
  className = '',
}: PriceDisplayProps) {
  const { user } = useAuth();

  const retail = Number(priceRetail);
  const old = priceRetailOld ? Number(priceRetailOld) : null;

  // Determine the effective price for the current user
  const wholesaleGroup = user?.wholesaleGroup ?? null;
  const userWholesalePrice = resolveWholesalePrice(
    { priceWholesale, priceWholesale2, priceWholesale3 },
    wholesaleGroup
  );

  const isWholesaleUser = !!wholesaleGroup && userWholesalePrice !== null;
  const effectivePrice = isWholesaleUser ? userWholesalePrice : retail;

  const hasDiscount = old && old > retail;
  const discountPercent = hasDiscount ? Math.round(((old - retail) / old) * 100) : 0;

  // Wholesale user sees their group price as the main price
  if (isWholesaleUser) {
    const savings = retail - effectivePrice;
    return (
      <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
        <span className={`font-bold ${sizeClasses[size].current} text-[var(--color-primary-dark)]`}>
          {effectivePrice.toFixed(2)} ₴
        </span>
        <span className={`${sizeClasses[size].old} text-[var(--color-text-secondary)] line-through`}>
          {retail.toFixed(2)} ₴
        </span>
        {savings > 0 && (
          <span className="rounded-sm bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-xs font-bold text-[var(--color-primary)]">
            -{Math.round((savings / retail) * 100)}%
          </span>
        )}
        <div className="flex w-full">
          <span className="inline-flex items-center gap-1 rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
            Опт {wholesaleGroup}
          </span>
        </div>
      </div>
    );
  }

  // Regular user sees retail price
  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <span className={`font-bold ${sizeClasses[size].current} ${hasDiscount ? 'text-[var(--color-discount)]' : 'text-[var(--color-text)]'}`}>
        {retail.toFixed(2)} ₴
      </span>
      {hasDiscount && (
        <>
          <span className={`${sizeClasses[size].old} text-[var(--color-text-secondary)] line-through`}>
            {old.toFixed(2)} ₴
          </span>
          <span className="rounded-sm bg-[var(--color-secondary)] px-1.5 py-0.5 text-xs font-bold text-[#212121]">
            -{discountPercent}%
          </span>
        </>
      )}
    </div>
  );
}
