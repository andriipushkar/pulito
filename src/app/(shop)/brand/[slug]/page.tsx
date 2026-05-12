import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

export const revalidate = 300;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import ProductCard from '@/components/product/ProductCard';
import ProductCardSkeleton from '@/components/product/ProductCardSkeleton';
import CatalogClient from '@/app/(shop)/catalog/CatalogClient';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import { getProducts } from '@/services/product';
import { getCategories } from '@/services/category';
import { getBrandBySlug, getBrandsForCatalog } from '@/services/brand';
import { Search } from '@/components/icons';

interface BrandPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: 'Виробник не знайдено' };

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const title = `${brand.name} — продукція виробника`;
  const description =
    brand.description ||
    `Каталог продукції виробника ${brand.name}. ${brand._count.products} товарів за вигідними цінами.`;
  const url = `${baseUrl}/brand/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Pulito Trade',
      ...(brand.logoPath && { images: [{ url: `${baseUrl}${brand.logoPath}`, alt: brand.name }] }),
    },
  };
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const page = Number(sp.page) || 1;
  const limit = 20;
  const sort = (typeof sp.sort === 'string' ? sp.sort : 'popular') as
    | 'popular'
    | 'price_asc'
    | 'price_desc'
    | 'name_asc'
    | 'newest'
    | 'brand_asc'
    | 'brand_desc';
  const priceMin = sp.price_min ? Number(sp.price_min) : undefined;
  const priceMax = sp.price_max ? Number(sp.price_max) : undefined;
  const promo = sp.promo === 'true' ? true : undefined;
  const inStock = sp.in_stock === 'true' ? true : undefined;

  const [{ products, total }, categories, brands] = await Promise.all([
    getProducts({
      page,
      limit,
      brand: slug,
      sort,
      priceMin,
      priceMax,
      promo,
      inStock,
    }),
    getCategories(),
    getBrandsForCatalog(),
  ]);

  const totalPages = Math.ceil(total / limit);

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Виробники', href: '/catalog' },
    { label: brand.name },
  ];

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const breadcrumbJsonLdItems = breadcrumbs
    .filter((b) => b.href)
    .map((b) => ({ name: b.label, url: `${baseUrl}${b.href}` }));

  const currentSearchParams: Record<string, string> = {};
  if (sort !== 'popular') currentSearchParams.sort = sort;
  if (priceMin) currentSearchParams.price_min = String(priceMin);
  if (priceMax) currentSearchParams.price_max = String(priceMax);
  if (promo) currentSearchParams.promo = 'true';
  if (inStock) currentSearchParams.in_stock = 'true';

  return (
    <Container className="py-6">
      <BreadcrumbJsonLd items={breadcrumbJsonLdItems} />
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      {/* Brand header */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-[var(--color-bg-secondary)] p-5">
        {brand.logoPath && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">
            <Image
              src={brand.logoPath}
              alt={brand.name}
              fill
              sizes="80px"
              className="object-contain p-2"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{brand.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {brand._count.products} {brand._count.products === 1 ? 'товар' : 'товарів'} у каталозі
          </p>
          {brand.description && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">
              {brand.description}
            </p>
          )}
        </div>
      </div>

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
            <EmptyState
              icon={<Search size={48} />}
              title="Товарів не знайдено"
              description="У цього виробника поки немає товарів за обраними фільтрами"
              actionLabel="До каталогу"
              actionHref="/catalog"
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                baseUrl={`/brand/${slug}`}
                searchParams={currentSearchParams}
                className="mt-8"
              />
            </>
          )}
        </CatalogClient>
      </Suspense>
    </Container>
  );
}
