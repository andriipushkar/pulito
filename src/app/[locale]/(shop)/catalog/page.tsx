import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';

// ISR: revalidate catalog every 60 seconds
export const revalidate = 60;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import ProductCard from '@/components/product/ProductCard';
import ProductCardSkeleton from '@/components/product/ProductCardSkeleton';
import ProductGridWishlistWrapper from '@/components/product/ProductGridWishlistWrapper';
import CatalogClient from './CatalogClient';
import PaginationLinks from '@/components/seo/PaginationLinks';
import { getProducts, getPopularProducts } from '@/services/product';
import { getCategories, getCategoryBySlug } from '@/services/category';
import { getBrandsForCatalog } from '@/services/brand';
import { prisma } from '@/lib/prisma';
import { Search } from '@/components/icons';
import { sanitizeHtml } from '@/utils/sanitize';
import { getLocale, getTranslations } from 'next-intl/server';
import { applyTranslations, applyTranslationsList, buildHreflang } from '@/lib/i18n';

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const params = await searchParams;
  const categorySlug = typeof params.category === 'string' ? params.category : undefined;
  const category = categorySlug ? await getCategoryBySlug(categorySlug) : null;
  const search = typeof params.search === 'string' ? params.search : undefined;

  const title = category
    ? `${category.name} — Каталог`
    : search
      ? `Пошук: ${search}`
      : 'Каталог товарів';

  const page = Number(params.page) || 1;
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const canonicalParams = new URLSearchParams();
  if (categorySlug) canonicalParams.set('category', categorySlug);
  if (page > 1) canonicalParams.set('page', String(page));
  const canonicalQuery = canonicalParams.toString();
  const canonical = `${baseUrl}/catalog${canonicalQuery ? `?${canonicalQuery}` : ''}`;

  return {
    title,
    description:
      category?.seoDescription ||
      'Каталог побутової хімії. Широкий вибір товарів за вигідними цінами.',
    // Deep pagination has thin SEO value — each product is in the sitemap on
    // its own. follow=true keeps crawlers walking through to the products.
    // Search-result pages have no SEO value either (user-typed queries).
    ...((page > 1 || search) && { robots: { index: false, follow: true } }),
    alternates: {
      canonical,
      languages: buildHreflang(`/catalog${canonicalQuery ? `?${canonicalQuery}` : ''}`),
    },
    openGraph: {
      title,
      description:
        category?.seoDescription ||
        'Каталог побутової хімії. Широкий вибір товарів за вигідними цінами.',
      url: canonical,
      type: 'website',
      siteName: 'Pulito Trade',
      images: [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description:
        category?.seoDescription ||
        'Каталог побутової хімії. Широкий вибір товарів за вигідними цінами.',
      images: [`${baseUrl}/opengraph-image`],
    },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;
  const category = typeof params.category === 'string' ? params.category : undefined;
  const brand = typeof params.brand === 'string' ? params.brand : undefined;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const priceMin = params.price_min ? Number(params.price_min) : undefined;
  const priceMax = params.price_max ? Number(params.price_max) : undefined;
  const promo = params.promo === 'true' ? true : undefined;
  const inStock = params.in_stock === 'true' ? true : undefined;
  const sort = (typeof params.sort === 'string' ? params.sort : 'popular') as
    | 'popular'
    | 'price_asc'
    | 'price_desc'
    | 'name_asc'
    | 'newest';

  const locale = await getLocale();
  const tCat = await getTranslations('catalog');
  const [{ products: rawProducts, total }, rawCategories, rawBrands] = await Promise.all([
    getProducts({
      page,
      limit,
      category,
      brand,
      search,
      priceMin,
      priceMax,
      promo,
      inStock,
      sort,
    }),
    getCategories(),
    getBrandsForCatalog(),
  ]);
  const products = applyTranslationsList(rawProducts, locale);
  const categories = applyTranslationsList(rawCategories, locale);
  const brands = applyTranslationsList(rawBrands, locale);

  const totalPages = Math.ceil(total / limit);
  const categoryDataRaw = category ? await getCategoryBySlug(category) : null;
  const categoryData = categoryDataRaw ? applyTranslations(categoryDataRaw, locale) : null;

  // If user searched and got 0 results, load popular products to show as suggestions
  const popularRaw = rawProducts.length === 0 && search ? await getPopularProducts(8) : [];
  const popularFallback = applyTranslationsList(popularRaw, locale);

  // Check for slug redirect if category not found
  if (category && !categoryData) {
    const slugRedirect = await prisma.slugRedirect.findUnique({
      where: { oldSlug: category },
    });
    if (slugRedirect && slugRedirect.type === 'category') {
      const redirectParams = new URLSearchParams();
      redirectParams.set('category', slugRedirect.newSlug);
      if (search) redirectParams.set('search', search);
      if (sort !== 'popular') redirectParams.set('sort', sort);
      redirect(`/catalog?${redirectParams.toString()}`);
    }
  }

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    ...(categoryData?.parent
      ? [{ label: categoryData.parent.name, href: `/catalog?category=${categoryData.parent.slug}` }]
      : []),
    ...(categoryData ? [{ label: categoryData.name }] : []),
  ];

  const currentSearchParams: Record<string, string> = {};
  if (category) currentSearchParams.category = category;
  if (brand) currentSearchParams.brand = brand;
  if (search) currentSearchParams.search = search;
  if (priceMin) currentSearchParams.price_min = String(priceMin);
  if (priceMax) currentSearchParams.price_max = String(priceMax);
  if (promo) currentSearchParams.promo = 'true';
  if (inStock) currentSearchParams.in_stock = 'true';
  if (sort !== 'popular') currentSearchParams.sort = sort;

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const collectionJsonLd = !search
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: categoryData?.name || 'Каталог товарів',
        url: `${baseUrl}/catalog${category ? `?category=${category}` : ''}`,
        ...(categoryData?.seoDescription && { description: categoryData.seoDescription }),
        isPartOf: {
          '@type': 'WebSite',
          name: 'Pulito Trade',
          url: baseUrl,
        },
        ...(products.length > 0 && {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: total,
            itemListElement: products.slice(0, 10).map((p, i) => ({
              '@type': 'ListItem',
              position: (page - 1) * limit + i + 1,
              url: `${baseUrl}/product/${p.slug}`,
              name: p.name,
            })),
          },
        }),
      }
    : null;

  return (
    <Container className="py-6">
      {collectionJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
        />
      )}
      <PaginationLinks
        currentPage={page}
        totalPages={totalPages}
        baseUrl={`${baseUrl}/catalog`}
        searchParams={currentSearchParams}
      />
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <h1 className="mb-6 text-2xl font-bold">
        {(() => {
          if (search) return `Результати пошуку: "${search}"`;
          if (categoryData) return categoryData.name;
          // Single-brand filter ⇒ show brand name as page title for clarity.
          const brandSlugs = brand ? brand.split(',').filter(Boolean) : [];
          if (brandSlugs.length === 1) {
            const b = brands.find((bb) => bb.slug === brandSlugs[0]);
            if (b) return b.name;
          }
          return tCat('title');
        })()}
      </h1>

      {/* Category SEO body — render the AI-generated category description
          (or manual override) right under the H1 so it indexes and the user
          can pick up tips for choosing a product. Only shown when a single
          category is filtered, never on general /catalog or search pages. */}
      {categoryData?.description && !search && (
        <div
          className="prose prose-sm max-w-none mb-8 text-[var(--color-text-secondary)]"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(categoryData.description) }}
        />
      )}

      <Suspense
        fallback={
          <div>
            <Skeleton className="mb-4 h-10 w-full" />
            <div className="mt-4 flex gap-6">
              <div className="hidden w-64 shrink-0 lg:block">
                <Skeleton className="h-[400px] w-full rounded-[var(--radius)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
      >
        <CatalogClient total={total} categories={categories} brands={brands}>
          {products.length === 0 ? (
            <div>
              <EmptyState
                icon={<Search size={48} />}
                title={search ? `Нічого не знайдено за «${search}»` : 'Товарів не знайдено'}
                description={
                  search
                    ? 'Перевірте, чи немає помилок у запиті, або скиньте фільтри й перегляньте схожі товари'
                    : 'Спробуйте змінити параметри фільтрації або пошуку'
                }
                actionLabel="Скинути фільтри"
                actionHref="/catalog"
              />
              {popularFallback.length > 0 && (
                <div className="mt-10">
                  <h2 className="mb-4 text-lg font-bold text-[var(--color-text)]">
                    Можливо, вас зацікавить
                  </h2>
                  <ProductGridWishlistWrapper productIds={popularFallback.map((p) => p.id)}>
                    <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {popularFallback.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </ProductGridWishlistWrapper>
                </div>
              )}
            </div>
          ) : (
            <ProductGridWishlistWrapper productIds={products.map((p) => p.id)}>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                baseUrl="/catalog"
                searchParams={currentSearchParams}
                className="mt-8"
              />
            </ProductGridWishlistWrapper>
          )}
        </CatalogClient>
      </Suspense>
    </Container>
  );
}
