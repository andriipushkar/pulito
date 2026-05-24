import type { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { notFound, redirect } from 'next/navigation';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ImageGallery from '@/components/product/ImageGallery';
import ProductInfo from '@/components/product/ProductInfo';
import ProductTabs from '@/components/product/ProductTabs';
import ProductJsonLd from '@/components/product/ProductJsonLd';
import ProductFaqJsonLd from '@/components/product/ProductFaqJsonLd';
import ProductOgProperty from '@/components/product/ProductOgProperty';
import ProductCarousel from '@/components/product/ProductCarousel';
import RecentlyViewedTracker from '@/components/product/RecentlyViewedTracker';
import ViewItemTracker from '@/components/product/ViewItemTracker';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import FloatingBuyBar from '@/components/product/FloatingBuyBar';
import ProductCarouselSkeleton from '@/components/ui/ProductCarouselSkeleton';
import ReviewSectionSkeleton from '@/components/ui/ReviewSectionSkeleton';
import Skeleton from '@/components/ui/Skeleton';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import ReviewAggregateJsonLd from '@/components/seo/ReviewAggregateJsonLd';
import { getProductBySlug, getProducts } from '@/services/product';
import { getProductRatingStats } from '@/services/review';
import { prisma } from '@/lib/prisma';

const RecentlyViewedSection = dynamic(() => import('@/components/product/RecentlyViewedSection'));
const PriceHistoryChart = dynamic(() => import('@/components/product/PriceHistoryChart'));
const BoughtTogetherSection = dynamic(() => import('@/components/product/BoughtTogetherSection'));
const ReviewSection = dynamic(() => import('@/components/product/ReviewSection'));

// ISR: revalidate product pages every 120 seconds
export const revalidate = 120;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Товар не знайдено' };

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const title = product.content?.seoTitle || product.name;
  const description =
    product.content?.seoDescription ||
    product.content?.shortDescription ||
    `${product.name} — купити за вигідною ціною в Pulito Trade`;
  const image = product.images[0]?.pathFull || product.imagePath;
  const url = `${baseUrl}/product/${slug}`;

  const price = Number(product.priceRetail);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        uk: url,
        en: `${baseUrl}/en/product/${slug}`,
        'x-default': url,
      },
    },
    openGraph: {
      title,
      description,
      url,
      images: [
        {
          url: `${baseUrl}/api/og?title=${encodeURIComponent(product.name)}&price=${price}&oldPrice=${product.priceRetailOld ? Number(product.priceRetailOld) : ''}&category=${encodeURIComponent(product.category?.name || '')}&image=${image ? encodeURIComponent(`${baseUrl}${image}`) : ''}`,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      // og:type set via `other` below — Next.js's Metadata type whitelists
      // only website/article/book/profile/music.*/video.*, but the OG Product
      // Markup spec (og:type=product + product:*) needs the "product" value
      // for FB/IG/Telegram to render a price-aware product card on share.
      siteName: 'Pulito Trade',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image && { images: [image] }),
    },
    // og:type=product and product:* meta tags MUST use `property=` per the
    // OG Product Markup spec — Facebook/Telegram/IG only parse `property=`.
    // Next.js's `other` field renders as `name=`, so we inject these via a
    // <meta property="..."> server component in the page body instead.
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    const slugRedirect = await prisma.slugRedirect.findUnique({
      where: { oldSlug: slug },
    });
    if (slugRedirect) redirect(`/product/${slugRedirect.newSlug}`);
    notFound();
  }

  const ratingStats = await getProductRatingStats(product.id);

  const relatedProducts = product.category
    ? (
        await getProducts({
          category: product.category.slug,
          page: 1,
          limit: 8,
          sort: 'popular',
        })
      ).products.filter((p) => p.id !== product.id)
    : [];

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    ...(product.category?.parent
      ? [
          {
            label: product.category.parent.name,
            href: `/catalog?category=${product.category.parent.slug}`,
          },
        ]
      : []),
    ...(product.category
      ? [{ label: product.category.name, href: `/catalog?category=${product.category.slug}` }]
      : []),
    { label: product.name },
  ];

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const breadcrumbJsonLdItems = breadcrumbs
    .filter((b) => b.href)
    .map((b) => ({ name: b.label, url: `${baseUrl}${b.href}` }));

  return (
    <Container className="py-6">
      <ProductJsonLd product={product} ratingStats={ratingStats} />
      <BreadcrumbJsonLd items={breadcrumbJsonLdItems} />
      <ProductFaqJsonLd fullDescription={product.content?.fullDescription} />
      <ProductOgProperty
        price={Number(product.priceRetail)}
        availability={product.quantity > 0 ? 'in stock' : 'out of stock'}
        retailerItemId={product.code}
      />
      {ratingStats && ratingStats.totalReviews > 0 && (
        <ReviewAggregateJsonLd
          productName={product.name}
          productUrl={`${baseUrl}/product/${slug}`}
          ratingValue={ratingStats.averageRating}
          reviewCount={ratingStats.totalReviews}
        />
      )}
      <RecentlyViewedTracker productId={product.id} />
      <PageViewTracker eventType="product_view" productId={product.id} />
      <ViewItemTracker
        id={product.id}
        code={product.code}
        name={product.name}
        price={Number(product.priceRetail)}
        brand={product.brand?.name}
        category={product.category?.name}
      />

      <Breadcrumbs items={breadcrumbs} className="mb-6" />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <ImageGallery images={product.images} productName={product.name} />
        <ProductInfo product={product} />
      </div>

      <div className="mt-10">
        <ProductTabs content={product.content} />
      </div>

      <Suspense fallback={<ReviewSectionSkeleton />}>
        <ReviewSection productId={product.id} />
      </Suspense>

      <Suspense fallback={<Skeleton className="mt-10 h-[300px] w-full rounded-2xl" />}>
        <PriceHistoryChart productSlug={slug} />
      </Suspense>

      <Suspense fallback={<ProductCarouselSkeleton />}>
        <BoughtTogetherSection productId={product.id} />
      </Suspense>

      {relatedProducts.length > 0 && (
        <Suspense fallback={<ProductCarouselSkeleton />}>
          <ProductCarousel
            title="Схожі товари"
            products={relatedProducts}
            viewAllHref={
              product.category ? `/catalog?category=${product.category.slug}` : '/catalog'
            }
          />
        </Suspense>
      )}

      <RecentlyViewedSection />

      <FloatingBuyBar
        productId={product.id}
        name={product.name}
        slug={product.slug}
        code={product.code}
        priceRetail={Number(product.priceRetail)}
        priceWholesale={product.priceWholesale ? Number(product.priceWholesale) : null}
        priceWholesale2={product.priceWholesale2 ? Number(product.priceWholesale2) : null}
        priceWholesale3={product.priceWholesale3 ? Number(product.priceWholesale3) : null}
        imagePath={product.images[0]?.pathMedium || product.imagePath}
        quantity={product.quantity}
      />
    </Container>
  );
}
