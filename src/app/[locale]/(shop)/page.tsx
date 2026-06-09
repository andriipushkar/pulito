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
import { buildHreflang } from '@/lib/i18n';

const _baseUrl = process.env.APP_URL || 'https://pulito.trade';
const _heroDescription =
  'Pulito Trade — інтернет-магазин побутової хімії. Широкий асортимент засобів для прибирання, прання та догляду за домом з доставкою по Україні.';

export const metadata: Metadata = {
  title: 'Головна',
  description: _heroDescription,
  alternates: {
    canonical: _baseUrl,
    languages: buildHreflang('/'),
  },
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
import { getHomepageBlocks, getSeoText } from '@/services/homepage';

export default async function HomePage() {
  const [categories, promoProducts, newProducts, popularProducts, blocks, seoText, t] =
    await Promise.all([
      getCategories(),
      getPromoProducts(10),
      getNewProducts(10),
      getPopularProducts(10),
      getHomepageBlocks(),
      getSeoText(),
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
    // Stored as already-sanitized HTML (admin PATCH runs sanitizeHtml before
    // persisting), so rendering it directly is safe. Hidden when empty so an
    // enabled-but-blank block doesn't leave a gap.
    seo_text: seoText.trim() ? (
      <section
        className="text-sm leading-relaxed text-[var(--color-text-secondary)] [&_a]:text-[var(--color-primary)] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--color-text)] [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-[var(--color-text)] [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: seoText }}
      />
    ) : null,
  };

  return (
    <Container className="py-4 sm:py-6 lg:py-8">
      {/* Organization (LocalBusiness) + WebSite/SearchAction JSON-LD are emitted
          once site-wide in the root layout. Don't duplicate them here — two
          WebSite or two Organization nodes on one page weaken rich results. */}
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
