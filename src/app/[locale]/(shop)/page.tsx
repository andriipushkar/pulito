import type { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { getTranslations } from 'next-intl/server';
import Container from '@/components/ui/Container';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';
import BannerSlider from '@/components/home/BannerSlider';
import CategoryGrid from '@/components/home/CategoryGrid';
import ProductCarousel from '@/components/product/ProductCarousel';
import ProductCarouselSkeleton from '@/components/ui/ProductCarouselSkeleton';
import Skeleton from '@/components/ui/Skeleton';
import SearchActionJsonLd from '@/components/seo/SearchActionJsonLd';

const _baseUrl = process.env.APP_URL || 'https://pulito.trade';
const _heroDescription =
  'Pulito Trade — інтернет-магазин побутової хімії. Широкий асортимент засобів для прибирання, прання та догляду за домом з доставкою по Україні.';

export const metadata: Metadata = {
  title: 'Головна',
  description: _heroDescription,
  openGraph: {
    title: 'Pulito Trade — побутова хімія з доставкою',
    description: _heroDescription,
    url: _baseUrl,
    siteName: 'Pulito Trade',
    type: 'website',
    images: [{ url: `${_baseUrl}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pulito Trade — побутова хімія з доставкою',
    description: _heroDescription,
    images: [`${_baseUrl}/opengraph-image`],
  },
};

const RecentlyViewedSection = dynamic(() => import('@/components/product/RecentlyViewedSection'));

// ISR: revalidate homepage every 60 seconds
export const revalidate = 60;
import { getCategories } from '@/services/category';
import { getPromoProducts, getNewProducts, getPopularProducts } from '@/services/product';
import { getHomepageBlocks } from '@/services/homepage';

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
  const [categories, promoProducts, newProducts, popularProducts, blocks, t] = await Promise.all([
    getCategories(),
    getPromoProducts(10),
    getNewProducts(10),
    getPopularProducts(10),
    getHomepageBlocks(),
    getTranslations('home'),
  ]);

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
            title={t('promoTitle')}
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
            title={t('newTitle')}
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
            title={t('popularTitle')}
            products={popularProducts}
            viewAllHref="/catalog?sort=popular"
            accent="hits"
          />
        </Suspense>
      ) : null,
    seo_text: null,
  };

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
    </Container>
  );
}
