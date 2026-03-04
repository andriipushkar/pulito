import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ImageGallery from '@/components/product/ImageGallery';
import ProductInfo from '@/components/product/ProductInfo';
import ProductTabs from '@/components/product/ProductTabs';
import ProductJsonLd from '@/components/product/ProductJsonLd';
import ProductCarousel from '@/components/product/ProductCarousel';
import RecentlyViewedTracker from '@/components/product/RecentlyViewedTracker';
import RecentlyViewedSection from '@/components/product/RecentlyViewedSection';
import PriceHistoryChart from '@/components/product/PriceHistoryChart';
import BoughtTogetherSection from '@/components/product/BoughtTogetherSection';
import FloatingBuyBar from '@/components/product/FloatingBuyBar';
import { getProductBySlug, getProducts } from '@/services/product';
import { prisma } from '@/lib/prisma';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Товар не знайдено' };

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const title = product.content?.seoTitle || product.name;
  const description = product.content?.seoDescription || product.content?.shortDescription || `${product.name} — купити за вигідною ціною в Порошок`;
  const image = product.images[0]?.pathFull || product.imagePath;
  const url = `${baseUrl}/product/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      ...(image && { images: [{ url: image }] }),
      type: 'website',
      siteName: 'Порошок',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image && { images: [image] }),
    },
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

  const relatedProducts = product.category
    ? (await getProducts({
        category: product.category.slug,
        page: 1,
        limit: 8,
        sort: 'popular',
      })).products.filter((p) => p.id !== product.id)
    : [];

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    ...(product.category?.parent
      ? [{ label: product.category.parent.name, href: `/catalog?category=${product.category.parent.slug}` }]
      : []),
    ...(product.category
      ? [{ label: product.category.name, href: `/catalog?category=${product.category.slug}` }]
      : []),
    { label: product.name },
  ];

  return (
    <Container className="py-6">
      <ProductJsonLd product={product} />
      <RecentlyViewedTracker productId={product.id} />

      <Breadcrumbs items={breadcrumbs} className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-2">
        <ImageGallery images={product.images} productName={product.name} />
        <ProductInfo product={product} />
      </div>

      <div className="mt-8">
        <ProductTabs content={product.content} />
      </div>

      <PriceHistoryChart productSlug={slug} />

      <BoughtTogetherSection productId={product.id} />

      {relatedProducts.length > 0 && (
        <ProductCarousel
          title="Схожі товари"
          products={relatedProducts}
          viewAllHref={product.category ? `/catalog?category=${product.category.slug}` : '/catalog'}
        />
      )}

      <RecentlyViewedSection />

      <FloatingBuyBar
        productId={product.id}
        name={product.name}
        slug={product.slug}
        code={product.code}
        priceRetail={Number(product.priceRetail)}
        priceWholesale={product.priceWholesale ? Number(product.priceWholesale) : null}
        imagePath={product.images[0]?.pathMedium || product.imagePath}
        quantity={product.quantity}
      />
    </Container>
  );
}
