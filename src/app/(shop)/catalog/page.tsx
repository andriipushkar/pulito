import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ProductCard from '@/components/product/ProductCard';
import CatalogClient from './CatalogClient';
import { getProducts } from '@/services/product';
import { getCategories, getCategoryBySlug } from '@/services/category';
import { prisma } from '@/lib/prisma';
import { Search } from '@/components/icons';

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
    description: category?.seoDescription || 'Каталог побутової хімії. Широкий вибір товарів за вигідними цінами.',
    alternates: {
      canonical,
    },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;
  const category = typeof params.category === 'string' ? params.category : undefined;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const priceMin = params.price_min ? Number(params.price_min) : undefined;
  const priceMax = params.price_max ? Number(params.price_max) : undefined;
  const promo = params.promo === 'true' ? true : undefined;
  const inStock = params.in_stock === 'true' ? true : undefined;
  const sort = (typeof params.sort === 'string' ? params.sort : 'popular') as 'popular' | 'price_asc' | 'price_desc' | 'name_asc' | 'newest';

  const [{ products, total }, categories] = await Promise.all([
    getProducts({ page, limit, category, search, priceMin, priceMax, promo, inStock, sort }),
    getCategories(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const categoryData = category ? await getCategoryBySlug(category) : null;

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
  if (search) currentSearchParams.search = search;
  if (priceMin) currentSearchParams.price_min = String(priceMin);
  if (priceMax) currentSearchParams.price_max = String(priceMax);
  if (promo) currentSearchParams.promo = 'true';
  if (inStock) currentSearchParams.in_stock = 'true';
  if (sort !== 'popular') currentSearchParams.sort = sort;

  return (
    <Container className="py-6">
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <h1 className="mb-6 text-2xl font-bold">
        {categoryData?.name || (search ? `Результати пошуку: "${search}"` : 'Каталог товарів')}
      </h1>

      <CatalogClient total={total} categories={categories}>
        {products.length === 0 ? (
          <EmptyState
            icon={<Search size={48} />}
            title="Товарів не знайдено"
            description="Спробуйте змінити параметри фільтрації або пошуку"
            actionLabel="Скинути фільтри"
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
              baseUrl="/catalog"
              searchParams={currentSearchParams}
              className="mt-8"
            />
          </>
        )}
      </CatalogClient>
    </Container>
  );
}
