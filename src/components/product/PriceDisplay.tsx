interface PriceDisplayProps {
  priceRetail: string | number;
  priceWholesale?: string | number | null;
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
  priceRetailOld,
  size = 'md',
  className = '',
}: PriceDisplayProps) {
  const retail = Number(priceRetail);
  const old = priceRetailOld ? Number(priceRetailOld) : null;
  const wholesale = priceWholesale ? Number(priceWholesale) : null;
  const hasDiscount = old && old > retail;
  const discountPercent = hasDiscount ? Math.round(((old - retail) / old) * 100) : 0;

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
      {wholesale !== null && (
        <div className="flex w-full flex-col gap-1 pt-1">
          <span className={`${sizeClasses[size].old} inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)]/10 px-2.5 py-1 font-bold text-[var(--color-primary-dark)]`} title="Оптова ціна від 5 шт.">
            <span className="rounded bg-[var(--color-primary)] px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-white">Опт</span>
            {wholesale.toFixed(2)} ₴
          </span>
          {retail > wholesale && (
            <span className="text-[11px] text-[var(--color-in-stock)]">
              Економія {(retail - wholesale).toFixed(0)} ₴ при купівлі оптом
            </span>
          )}
        </div>
      )}
    </div>
  );
}
