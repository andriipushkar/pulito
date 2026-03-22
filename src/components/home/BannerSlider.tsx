'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@/components/icons';

interface Banner {
  id: number;
  title: string | null;
  subtitle: string | null;
  imageDesktop: string;
  imageMobile?: string | null;
  buttonLink: string | null;
  buttonText: string | null;
}

const bannerStyles = [
  'from-[#0D47A1] via-[#1565C0] to-[#1E88E5]',
  'from-[#1565C0] via-[#1976D2] to-[#0D47A1]',
  'from-[#0D47A1] via-[#1E88E5] to-[#1565C0]',
];

function BannerDecoration({ index }: { index: number }) {
  if (index === 0)
    return (
      <>
        <svg className="absolute -right-20 -top-20 h-96 w-96 opacity-[0.06]" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="white" /></svg>
        <svg className="absolute -bottom-24 -left-10 h-80 w-80 opacity-[0.04]" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="white" /></svg>
      </>
    );
  if (index === 1)
    return (
      <>
        <svg className="absolute -right-10 bottom-0 h-72 w-72 opacity-[0.05]" viewBox="0 0 200 200"><rect x="10" y="10" width="180" height="180" rx="50" fill="white" /></svg>
        <svg className="absolute -left-16 -top-16 h-64 w-64 opacity-[0.04]" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="white" /></svg>
      </>
    );
  return (
    <>
      <svg className="absolute -bottom-10 right-20 h-80 w-80 opacity-[0.05]" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="white" /></svg>
      <svg className="absolute -top-10 -left-10 h-56 w-56 opacity-[0.04]" viewBox="0 0 200 200"><rect x="20" y="20" width="160" height="160" rx="80" fill="white" /></svg>
    </>
  );
}

function highlightGold(text: string) {
  const parts = text.split(/(-?\d+%?|₴|\d[\d\s]*₴)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    /\d|₴/.test(part) ? (
      <span key={i} className="inline-block bg-gradient-to-r from-[#FFD54F] via-[#FFECB3] to-[#FFD54F] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(255,193,7,0.5)]" style={{ fontSize: '1.15em', fontWeight: 900 }}>{part}</span>
    ) : part
  );
}

const AUTOPLAY_INTERVAL = 5000;

const fallbackBanners: Banner[] = [
  {
    id: 1,
    title: null,
    subtitle: null,
    imageDesktop: '/images/banners/banner-1.png',
    buttonLink: '/catalog?promo=true',
    buttonText: null,
  },
  {
    id: 2,
    title: null,
    subtitle: null,
    imageDesktop: '/images/banners/banner-2.png',
    buttonLink: '/catalog?promo=true',
    buttonText: null,
  },
  {
    id: 3,
    title: null,
    subtitle: null,
    imageDesktop: '/images/banners/banner-3.png',
    buttonLink: '/pages/delivery',
    buttonText: null,
  },
];

export default function BannerSlider() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const genericTitles = ['новий банер', 'new banner', 'тестовий банер', 'test banner'];
    fetch('/api/v1/banners', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) {
          if (data.data.length === 0) {
            setBanners([]);
          } else {
            const meaningful = data.data.filter(
              (b: Banner) =>
                b.imageDesktop ||
                (b.title && !genericTitles.includes(b.title.trim().toLowerCase()))
            );
            setBanners(meaningful.length ? meaningful : []);
          }
        } else {
          // API failed — show fallback
          setBanners(fallbackBanners);
        }
      })
      .catch(() => {
        setBanners(fallbackBanners);
      });
  }, []);

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);
  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      setProgressKey((k) => k + 1);
    };
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      emblaApi.scrollNext();
    }, AUTOPLAY_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [emblaApi, isPaused, selectedIndex]);

  if (!banners || !banners.length) return null;

  return (
    <section
      className="relative overflow-hidden rounded-3xl shadow-[var(--shadow-xl)]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner, idx) => (
            <div key={banner.id} className="min-w-0 shrink-0 basis-full">
              <Link href={banner.buttonLink || '/'} className="relative block">
                <div className="relative aspect-[5/2] overflow-hidden">
                  {banner.imageDesktop ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={banner.imageDesktop}
                      alt={banner.title || ''}
                      className="block h-full w-full object-cover"
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${bannerStyles[idx % bannerStyles.length]} overflow-hidden`}>
                      <BannerDecoration index={idx % 3} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-start justify-end p-4 text-white sm:p-10 lg:max-w-[60%] lg:p-14">
                    {(banner.title || banner.buttonText) && (
                      <div className="glass-dark rounded-2xl px-4 py-3 sm:rounded-3xl sm:px-6 sm:py-4">
                        {banner.title && (
                          <h2 className="text-xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-5xl" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>{highlightGold(banner.title)}</h2>
                        )}
                        {banner.subtitle && (
                          <p className="mt-1 hidden max-w-md text-sm font-light opacity-90 sm:block sm:text-lg">{banner.subtitle}</p>
                        )}
                        {banner.buttonText && (
                          <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2 text-sm font-bold text-[var(--color-primary-dark)] shadow-lg transition-all duration-300 hover:scale-[1.05] hover:bg-white active:scale-[0.98] sm:mt-3 sm:px-8 sm:py-3 sm:text-base">
                            {banner.buttonText}
                            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={scrollPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg backdrop-blur-md transition-all hover:bg-white hover:shadow-[var(--shadow-brand)] sm:left-4 sm:p-2.5"
        aria-label="Попередній"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-lg backdrop-blur-md transition-all hover:bg-white hover:shadow-[var(--shadow-brand)] sm:right-4 sm:p-2.5"
        aria-label="Наступний"
      >
        <ChevronRight size={18} />
      </button>

      {/* Progress bar indicators */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-4 sm:gap-2">
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className="group relative h-1 w-8 overflow-hidden rounded-full bg-white/30 transition-all sm:h-1.5 sm:w-10"
            aria-label={`Слайд ${i + 1}`}
          >
            {i === selectedIndex && (
              <span
                key={progressKey}
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{
                  animation: isPaused ? 'none' : `progress-bar ${AUTOPLAY_INTERVAL}ms linear forwards`,
                  width: isPaused ? '100%' : undefined,
                }}
              />
            )}
            {i !== selectedIndex && (
              <span className="absolute inset-0 rounded-full bg-white/0 transition-colors group-hover:bg-white/40" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
