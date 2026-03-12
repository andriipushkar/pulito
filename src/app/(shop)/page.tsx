import dynamic from 'next/dynamic';
import Container from '@/components/ui/Container';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';
import BannerSlider from '@/components/home/BannerSlider';
import CategoryGrid from '@/components/home/CategoryGrid';
import ProductCarousel from '@/components/product/ProductCarousel';

const BrandLogos = dynamic(() => import('@/components/home/BrandLogos'));
const RecentlyViewedSection = dynamic(() => import('@/components/product/RecentlyViewedSection'));

// ISR: revalidate homepage every 60 seconds
export const revalidate = 60;
import { getCategories } from '@/services/category';
import { getPromoProducts, getNewProducts, getPopularProducts } from '@/services/product';
import { getHomepageBlocks } from '@/services/homepage';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Порошок',
  url: process.env.APP_URL || 'https://poroshok.ua',
  logo: `${process.env.APP_URL || 'https://poroshok.ua'}/images/icon-512.png`,
  description:
    'Оптово-роздрібний інтернет-магазин побутової хімії. Широкий асортимент, вигідні ціни, швидка доставка по Україні.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'UA',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: 'Ukrainian',
  },
  sameAs: [
    process.env.INSTAGRAM_PROFILE_URL,
    process.env.TELEGRAM_CHANNEL_URL,
  ].filter(Boolean),
};

export default async function HomePage() {
  const [categories, promoProducts, newProducts, popularProducts, blocks] = await Promise.all([
    getCategories(),
    getPromoProducts(10),
    getNewProducts(10),
    getPopularProducts(10),
    getHomepageBlocks(),
  ]);

  const enabledBlocks = blocks.filter((b) => b.enabled);

  const blockComponents: Record<string, React.ReactNode> = {
    banner_slider: <BannerSlider />,
    categories: categories.length > 0 ? <CategoryGrid categories={categories} /> : null,
    promo_products: promoProducts.length > 0 ? (
      <ProductCarousel
        title="Акційні товари"
        products={promoProducts}
        viewAllHref="/catalog?promo=true"
      />
    ) : null,
    new_products: newProducts.length > 0 ? (
      <ProductCarousel
        title="Новинки"
        products={newProducts}
        viewAllHref="/catalog?sort=newest"
      />
    ) : null,
    popular_products: popularProducts.length > 0 ? (
      <ProductCarousel
        title="Хіти продажів"
        products={popularProducts}
        viewAllHref="/catalog?sort=popular"
      />
    ) : null,
    brands: <BrandLogos />,
    seo_text: (
      <section>
        <div className="rounded-2xl border border-[var(--color-border)]/40 bg-gradient-to-br from-[var(--color-primary-50)]/60 to-white p-5 sm:p-6 lg:p-8">
          <h2 className="mb-2 text-base font-semibold tracking-tight text-[var(--color-text)] sm:text-lg lg:text-xl">Інтернет-магазин побутової хімії Порошок</h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-[var(--color-text-secondary)] sm:text-sm">
            Ласкаво просимо до Порошок — вашого надійного постачальника побутової хімії в Україні.
            Ми пропонуємо широкий асортимент засобів для прибирання, прання, миття посуду та догляду за домом
            від провідних світових та вітчизняних виробників. Оптовим покупцям — спеціальні ціни та умови
            співпраці. Швидка доставка по всій Україні.
          </p>
        </div>
      </section>
    ),
  };

  return (
    <Container className="py-4 sm:py-6 lg:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
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
