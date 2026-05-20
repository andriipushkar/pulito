import type { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Container from '@/components/ui/Container';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';
import BannerSlider from '@/components/home/BannerSlider';
import CategoryGrid from '@/components/home/CategoryGrid';
import ProductCarousel from '@/components/product/ProductCarousel';
import ProductCarouselSkeleton from '@/components/ui/ProductCarouselSkeleton';
import Skeleton from '@/components/ui/Skeleton';
import SearchActionJsonLd from '@/components/seo/SearchActionJsonLd';

export const metadata: Metadata = {
  title: 'Головна',
  description:
    'Pulito Trade — інтернет-магазин побутової хімії. Широкий асортимент засобів для прибирання, прання та догляду за домом з доставкою по Україні.',
};

const RecentlyViewedSection = dynamic(() => import('@/components/product/RecentlyViewedSection'));

// ISR: revalidate homepage every 60 seconds
export const revalidate = 60;
import { getCategories } from '@/services/category';
import { getPromoProducts, getNewProducts, getPopularProducts } from '@/services/product';
import { getHomepageBlocks, getSeoText } from '@/services/homepage';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Pulito Trade',
  url: process.env.APP_URL || 'https://pulito.trade',
  logo: `${process.env.APP_URL || 'https://pulito.trade'}/images/icon-512.png`,
  description:
    'Гуртово-роздрібний інтернет-магазин побутової хімії. Широкий асортимент, вигідні ціни, швидка доставка по Україні.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'UA',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: 'Ukrainian',
  },
  sameAs: [process.env.INSTAGRAM_PROFILE_URL, process.env.TELEGRAM_CHANNEL_URL].filter(Boolean),
};

export default async function HomePage() {
  const [categories, promoProducts, newProducts, popularProducts, blocks] = await Promise.all([
    getCategories(),
    getPromoProducts(10),
    getNewProducts(10),
    getPopularProducts(10),
    getHomepageBlocks(),
  ]);

  const seoText = await getSeoText();

  const enabledBlocks = blocks.filter((b) => b.enabled);

  const blockComponents: Record<string, React.ReactNode> = {
    banner_slider: (
      <Suspense fallback={<Skeleton className="aspect-[5/2] w-full rounded-3xl" />}>
        <BannerSlider />
      </Suspense>
    ),
    categories:
      categories.length > 0 ? (
        <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-2xl" />}>
          <CategoryGrid categories={categories} />
        </Suspense>
      ) : null,
    promo_products:
      promoProducts.length > 0 ? (
        <Suspense fallback={<ProductCarouselSkeleton />}>
          <ProductCarousel
            title="Акційні товари"
            products={promoProducts}
            viewAllHref="/catalog?promo=true"
            accent="promo"
          />
        </Suspense>
      ) : null,
    new_products:
      newProducts.length > 0 ? (
        <Suspense fallback={<ProductCarouselSkeleton />}>
          <ProductCarousel
            title="Новинки"
            products={newProducts}
            viewAllHref="/catalog?sort=newest"
            accent="new"
          />
        </Suspense>
      ) : null,
    popular_products:
      popularProducts.length > 0 ? (
        <Suspense fallback={<ProductCarouselSkeleton />}>
          <ProductCarousel
            title="Хіти продажів"
            products={popularProducts}
            viewAllHref="/catalog?sort=popular"
            accent="hits"
          />
        </Suspense>
      ) : null,
    // seo_text is rendered separately at the bottom (above the footer)
    seo_text: null,
  };

  const seoBlockEnabled = enabledBlocks.some((b) => b.key === 'seo_text');
  const seoContent =
    seoText ||
    'Ласкаво просимо до Pulito Trade — вашого надійного постачальника побутової хімії в Україні. Ми пропонуємо широкий асортимент засобів для прибирання, прання, миття посуду та догляду за домом від провідних світових та вітчизняних виробників. Гуртовим покупцям — спеціальні ціни та умови співпраці. Швидка доставка по всій Україні.';

  return (
    <Container className="py-4 sm:py-6 lg:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <SearchActionJsonLd />
      <div className="space-y-6 sm:space-y-8 lg:space-y-8">
        {enabledBlocks
          .filter((block) => blockComponents[block.key] != null)
          .map((block, index) => (
            <AnimateOnScroll key={block.key} delay={index * 100}>
              {blockComponents[block.key]}
            </AnimateOnScroll>
          ))}
      </div>

      {/* Recently viewed — rendered separately, self-hiding when empty */}
      <RecentlyViewedSection />

      {seoBlockEnabled && (
        <section className="mt-10 sm:mt-14 lg:mt-16">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)]/40 bg-gradient-to-br from-[var(--color-primary-50)]/70 via-white to-[var(--color-primary-50)]/40 p-6 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--color-primary)]/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[var(--color-gold)]/10 blur-3xl" />
            <div className="relative">
              <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl lg:text-4xl">
                Інтернет-магазин побутової хімії Pulito Trade
              </h2>
              <span className="mb-5 inline-block h-1 w-16 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-gold)]" />
              <div className="max-w-4xl space-y-3 text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
                {seoContent.split(/\n\n+/).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </Container>
  );
}
