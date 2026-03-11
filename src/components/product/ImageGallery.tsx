'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Modal from '@/components/ui/Modal';
import { ChevronLeft, ChevronRight, Close } from '@/components/icons';
import type { ProductImage } from '@/types/product';

interface ImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

export default function ImageGallery({ images, productName }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  const [loadedIndex, setLoadedIndex] = useState<number | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const [mobileRef, mobileApi] = useEmblaCarousel({ loop: true });
  const [mobileIndex, setMobileIndex] = useState(0);

  // Sync mobile carousel index
  const onMobileSelect = useCallback(() => {
    if (mobileApi) {
      const idx = mobileApi.selectedScrollSnap();
      setMobileIndex(idx);
      setSelectedIndex(idx);
    }
  }, [mobileApi]);

  useEffect(() => {
    if (!mobileApi) return;
    mobileApi.on('select', onMobileSelect);
    return () => { mobileApi.off('select', onMobileSelect); };
  }, [mobileApi, onMobileSelect]);

  const currentImage = images[selectedIndex];
  const mainImageLoaded = loadedIndex === selectedIndex;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: 'scale(2)',
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setZoomStyle({});
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-[var(--radius)] bg-[var(--color-bg-secondary)]">
        <span className="text-[var(--color-text-secondary)]">Зображення відсутнє</span>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex lg:gap-3">
        {/* Vertical thumbnails */}
        {images.length > 1 && (
          <div className="flex shrink-0 flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vw * 0.35)' }}>
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setSelectedIndex(i)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  i === selectedIndex ? 'border-[var(--color-primary)] shadow-[var(--shadow-brand)]' : 'border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.pathThumbnail || img.pathMedium || ''}
                  alt={img.altText || `${productName} ${i + 1}`}
                  className="h-16 w-16 object-contain"
                />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div className="flex-1">
          <div
            ref={mainRef}
            className="relative cursor-zoom-in overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            onClick={() => setLightboxOpen(true)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div className="relative aspect-square">
              {currentImage?.pathBlur && !mainImageLoaded && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentImage.pathBlur}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-contain blur-lg"
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage?.pathFull || currentImage?.pathMedium || ''}
                alt={currentImage?.altText || productName}
                className={`h-full w-full object-contain transition-all duration-200 ${mainImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                style={zoomStyle}
                onLoad={() => setLoadedIndex(selectedIndex)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)]" ref={mobileRef}>
          <div className="flex">
            {images.map((img, i) => (
              <div key={img.id} className="min-w-0 shrink-0 basis-full">
                <div className="aspect-square bg-[var(--color-bg-secondary)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.pathFull || img.pathMedium || ''}
                    alt={img.altText || `${productName} ${i + 1}`}
                    className="h-full w-full object-contain"
                    onClick={() => setLightboxOpen(true)}
                  />
                </div>
              </div>
            ))}
          </div>
          {images.length > 1 && (
            <>
              <div className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {mobileIndex + 1} / {images.length}
              </div>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => mobileApi?.scrollTo(i)}
                    className={`rounded-full transition-all ${
                      i === mobileIndex ? 'h-2 w-6 bg-[var(--color-primary)]' : 'h-2 w-2 bg-white/60'
                    }`}
                    aria-label={`Зображення ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <Modal isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} size="lg">
        <div className="relative bg-[#f9f9f9]">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-full bg-white border border-gray-200 shadow-[var(--shadow)] p-2 transition-colors hover:bg-gray-50"
            aria-label="Закрити"
          >
            <Close size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage?.pathOriginal || currentImage?.pathFull || ''}
            alt={currentImage?.altText || productName}
            className="mx-auto max-h-[80vh] object-contain"
          />
          {images.length > 1 && (
            <>
              <button
                onClick={() => setSelectedIndex((prev) => (prev - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white shadow-[var(--shadow)] text-gray-700 p-2 transition-colors hover:bg-gray-50"
                aria-label="Попередній"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => setSelectedIndex((prev) => (prev + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white shadow-[var(--shadow)] text-gray-700 p-2 transition-colors hover:bg-gray-50"
                aria-label="Наступний"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
