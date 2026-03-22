import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Badge from '@/components/ui/Badge';
import BundlePriceSummary from '@/components/bundle/BundlePriceSummary';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import AddBundleToCartButton from './AddBundleToCartButton';
import { getBundleBySlug, calculateBundlePrice } from '@/services/bundle';

export const revalidate = 120;

interface BundleDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BundleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getBundleBySlug(slug);
  if (!bundle) return { title: 'Комплект не знайдено' };

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/bundles/${slug}`;

  return {
    title: `${bundle.name} — Комплект`,
    description: bundle.description || `Комплект "${bundle.name}" — купити за вигідною ціною`,
    alternates: { canonical: url },
    openGraph: {
      title: `${bundle.name} — Комплект`,
      description: bundle.description || `Комплект "${bundle.name}" — купити за вигідною ціною`,
      url,
      type: 'website',
      siteName: 'Порошок',
      ...(bundle.imagePath && { images: [{ url: `${baseUrl}${bundle.imagePath}`, alt: bundle.name }] }),
    },
  };
}

export default async function BundleDetailPage({ params }: BundleDetailPageProps) {
  const { slug } = await params;
  const bundle = await getBundleBySlug(slug);
  if (!bundle) notFound();

  const pricing = await calculateBundlePrice(bundle.id);

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Комплекти', href: '/bundles' },
    { label: bundle.name },
  ];

  return (
    <Container className="py-6">
      <BreadcrumbJsonLd
        items={breadcrumbs
          .filter((b) => b.href)
          .map((b) => ({ name: b.label, url: `${process.env.APP_URL || 'http://localhost:3000'}${b.href}` }))}
      />
      <Breadcrumbs items={breadcrumbs} className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: bundle info */}
        <div>
          <div className="mb-6 flex flex-wrap items-start gap-3">
            <h1 className="text-2xl font-bold lg:text-3xl">{bundle.name}</h1>
            <Badge className="bg-[var(--color-primary)] text-white">
              {bundle.items.length} {bundle.items.length === 1 ? 'товар' : bundle.items.length < 5 ? 'товари' : 'товарів'}
            </Badge>
          </div>

          {bundle.description && (
            <p className="mb-6 text-[var(--color-text-secondary)]">{bundle.description}</p>
          )}

          {bundle.imagePath && (
            <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-2xl bg-[var(--color-bg-secondary)]">
              <Image
                src={bundle.imagePath}
                alt={bundle.name}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Products list */}
          <h2 className="mb-4 text-lg font-semibold">Товари в комплекті</h2>
          <div className="space-y-3">
            {bundle.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-3 transition-colors hover:bg-[var(--color-bg-secondary)]/50"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-secondary)]">
                  {item.product.imagePath ? (
                    <Image
                      src={item.product.imagePath}
                      alt={item.product.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">
                    {item.product.name}
                  </p>
                  {item.product.code && (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Код: {item.product.code}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {Number(item.product.priceRetail).toFixed(2)} ₴
                  </p>
                  {item.quantity > 1 && (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      x{item.quantity}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar: pricing + CTA */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BundlePriceSummary
            originalPrice={pricing.originalPrice}
            finalPrice={pricing.finalPrice}
            savings={pricing.savings}
            className="mb-4"
          />
          <AddBundleToCartButton slug={bundle.slug} />
        </div>
      </div>
    </Container>
  );
}
