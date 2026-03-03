import Container from '@/components/ui/Container';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';
import BannerSlider from '@/components/home/BannerSlider';
import USPBlock from '@/components/home/USPBlock';
import CategoryGrid from '@/components/home/CategoryGrid';
import BrandLogos from '@/components/home/BrandLogos';
import ProductCarousel from '@/components/product/ProductCarousel';
import RecentlyViewedSection from '@/components/product/RecentlyViewedSection';
import { getCategories } from '@/services/category';
import { getPromoProducts, getNewProducts, getPopularProducts } from '@/services/product';
import { getHomepageBlocks } from '@/services/homepage';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Clean Shop',
  url: process.env.APP_URL || 'https://clean-shop.ua',
  logo: `${process.env.APP_URL || 'https://clean-shop.ua'}/images/icon-512.png`,
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
    usp: <USPBlock />,
    categories: <CategoryGrid categories={categories} />,
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
    recently_viewed: <RecentlyViewedSection />,
    brands: <BrandLogos />,
    seo_text: (
      <section className="py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary-50)] to-white p-8 shadow-[var(--shadow)]">
          <h2 className="mb-4 text-xl font-bold text-[var(--color-text)]">Інтернет-магазин побутової хімії Clean Shop</h2>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Ласкаво просимо до Clean Shop — вашого надійного постачальника побутової хімії в Україні.
            Ми пропонуємо широкий асортимент засобів для прибирання, прання, миття посуду та догляду за домом
            від провідних світових та вітчизняних виробників. Оптовим покупцям — спеціальні ціни та умови
            співпраці. Швидка доставка по всій Україні.
          </p>
        </div>
      </section>
    ),
  };

  return (
    <Container className="py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <div className="space-y-12">
      {enabledBlocks.map((block, index) => {
        const component = blockComponents[block.key];
        if (!component) return null;
        return (
          <AnimateOnScroll key={block.key} delay={index * 100}>
            {component}
          </AnimateOnScroll>
        );
      })}
      </div>
    </Container>
  );
}
