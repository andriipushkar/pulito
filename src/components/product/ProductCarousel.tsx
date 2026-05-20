'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Link from 'next/link';
import ProductCard from './ProductCard';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import type { ProductListItem } from '@/types/product';

type CarouselAccent = 'default' | 'promo' | 'new' | 'hits';

interface ProductCarouselProps {
  title: string;
  products: ProductListItem[];
  viewAllHref?: string;
  accent?: CarouselAccent;
}

const accentStyles: Record<CarouselAccent, {
  section: string;
  underline: string;
  iconLabel?: { label: string; bg: string; text: string };
}> = {
  default: {
    section: 'py-4 sm:py-6',
    underline: 'bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-light)]',
  },
  promo: {
    section: 'rounded-3xl bg-gradient-to-br from-red-50 via-orange-50 to-white px-4 py-5 sm:px-6 sm:py-7',
    underline: 'bg-gradient-to-r from-[#FF6B35] to-[#F44336]',
    iconLabel: { label: 'Акція', bg: 'bg-[#F44336]', text: 'text-white' },
  },
  new: {
    section: 'py-4 sm:py-6',
    underline: 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]',
    iconLabel: { label: 'New', bg: 'bg-[var(--color-primary)]', text: 'text-white' },
  },
  hits: {
    section: 'rounded-3xl bg-gradient-to-br from-amber-50 via-yellow-50 to-white px-4 py-5 sm:px-6 sm:py-7',
    underline: 'bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-light)]',
    iconLabel: { label: 'Hit', bg: 'bg-[var(--color-gold)]', text: 'text-white' },
  },
};

export default function ProductCarousel({ title, products, viewAllHref, accent = 'default' }: ProductCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    slidesToScroll: 1,
    align: 'start',
    containScroll: 'trimSnaps',
    breakpoints: {
      '(min-width: 1280px)': { slidesToScroll: 5 },
      '(min-width: 1024px)': { slidesToScroll: 4 },
      '(min-width: 768px)': { slidesToScroll: 3 },
      '(min-width: 640px)': { slidesToScroll: 2 },
    },
  });

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    sync();
    emblaApi.on('select', sync);
    emblaApi.on('reInit', sync);
    return () => {
      emblaApi.off('select', sync);
      emblaApi.off('reInit', sync);
    };
  }, [emblaApi]);

  if (products.length === 0) return null;

  const style = accentStyles[accent];

  return (
    <section className={style.section}>
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h2 className="relative inline-flex items-center gap-2 text-lg font-extrabold text-[var(--color-text)] sm:text-xl">
          {style.iconLabel && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.iconLabel.bg} ${style.iconLabel.text}`}
            >
              {style.iconLabel.label}
            </span>
          )}
          <span className="relative">
            {title}
            <span className={`absolute -bottom-1 left-0 h-0.5 w-10 rounded-full ${style.underline}`} />
          </span>
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
          >
            Дивитись все
          </Link>
        )}
      </div>

      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="-ml-4 flex">
            {products.map((product) => (
              <div
                key={product.id}
                className="min-w-0 shrink-0 basis-1/3 pl-4 md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>

        {/* Edge overlay arrows: round, larger, only enabled when scroll is possible */}
        <button
          type="button"
          onClick={scrollPrev}
          disabled={!canPrev}
          aria-label="Попередній"
          className={`absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--color-text)] shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)] transition-all hover:scale-110 hover:bg-[var(--color-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-0 sm:flex sm:h-10 sm:w-10 lg:h-12 lg:w-12`}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          disabled={!canNext}
          aria-label="Наступний"
          className={`absolute right-0 top-1/2 z-10 hidden translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--color-text)] shadow-[var(--shadow-md)] ring-1 ring-[var(--color-border)] transition-all hover:scale-110 hover:bg-[var(--color-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-0 sm:flex sm:h-10 sm:w-10 lg:h-12 lg:w-12`}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
