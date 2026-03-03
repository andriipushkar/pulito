'use client';

import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Link from 'next/link';
import ProductCard from './ProductCard';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import type { ProductListItem } from '@/types/product';

interface ProductCarouselProps {
  title: string;
  products: ProductListItem[];
  viewAllHref?: string;
}

export default function ProductCarousel({ title, products, viewAllHref }: ProductCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    slidesToScroll: 1,
    align: 'start',
    containScroll: 'trimSnaps',
    breakpoints: {
      '(min-width: 1536px)': { slidesToScroll: 6 },
      '(min-width: 1280px)': { slidesToScroll: 5 },
      '(min-width: 1024px)': { slidesToScroll: 4 },
      '(min-width: 768px)': { slidesToScroll: 3 },
      '(min-width: 640px)': { slidesToScroll: 2 },
    },
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (products.length === 0) return null;

  return (
    <section className="py-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="relative text-2xl font-extrabold text-[var(--color-text)]">
          {title}
          <span className="absolute -bottom-1 left-0 h-0.5 w-12 rounded-full bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-light)]" />
        </h2>
        <div className="flex items-center gap-3">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="rounded-full border border-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
            >
              Дивитись все
            </Link>
          )}
          <div className="flex gap-1">
            <button
              onClick={scrollPrev}
              className="rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
              aria-label="Попередній"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={scrollNext}
              className="rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
              aria-label="Наступний"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="-ml-4 flex">
          {products.map((product) => (
            <div
              key={product.id}
              className="min-w-0 shrink-0 basis-1/3 pl-4 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 2xl:basis-1/6"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
