import Link from 'next/link';
import Image from 'next/image';
import Badge from '@/components/ui/Badge';

interface BundlePricing {
  originalPrice: number;
  finalPrice: number;
  savings: number;
}

interface BundleCardProps {
  bundle: {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    imagePath?: string | null;
    items: { id: number; [key: string]: unknown }[];
    pricing: BundlePricing;
    [key: string]: unknown;
  };
}

export default function BundleCard({ bundle }: BundleCardProps) {
  const { pricing } = bundle;
  const hasDiscount = pricing.originalPrice > pricing.finalPrice;

  return (
    <Link
      href={`/bundles/${bundle.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] transition-shadow hover:shadow-[var(--shadow-lg)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-bg-secondary)]">
        {bundle.imagePath ? (
          <Image
            src={bundle.imagePath}
            alt={bundle.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <Badge className="bg-[var(--color-primary)] text-white">
            {bundle.items.length} {bundle.items.length === 1 ? 'товар' : bundle.items.length < 5 ? 'товари' : 'товарів'}
          </Badge>
          {hasDiscount && (
            <Badge className="bg-[#F44336] text-white">
              -{Math.round(((pricing.originalPrice - pricing.finalPrice) / pricing.originalPrice) * 100)}%
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 text-sm font-semibold leading-tight text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)]">
          {bundle.name}
        </h3>
        {bundle.description && (
          <p className="mb-3 text-xs text-[var(--color-text-secondary)] line-clamp-2">
            {bundle.description}
          </p>
        )}
        <div className="mt-auto flex items-baseline gap-2">
          <span className="text-lg font-bold text-[var(--color-text)]">
            {pricing.finalPrice.toFixed(2)} ₴
          </span>
          {hasDiscount && (
            <span className="text-sm text-[var(--color-text-secondary)] line-through">
              {pricing.originalPrice.toFixed(2)} ₴
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
