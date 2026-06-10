import { Link } from '@/i18n/navigation';
import Image from 'next/image';

interface BrandStripProps {
  title: string;
  brands: Array<{ slug: string; name: string; logoPath: string | null }>;
}

/**
 * Homepage "brands" block: logo tiles linking to /brand/[slug]. Brands
 * without a logo fall back to their name so the tile is never blank.
 */
export default function BrandStrip({ title, brands }: BrandStripProps) {
  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="relative inline-flex items-center gap-2 text-lg font-extrabold text-[var(--color-text)] sm:text-xl">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {brands.map((brand) => (
          <Link
            key={brand.slug}
            href={`/brand/${brand.slug}`}
            className="group flex h-20 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md"
          >
            {brand.logoPath ? (
              <div className="relative h-full w-full">
                <Image
                  src={brand.logoPath}
                  alt={brand.name}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                  className="object-contain p-2"
                />
              </div>
            ) : (
              <span className="text-center text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                {brand.name}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
