import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import EmptyState from '@/components/ui/EmptyState';
import BundleCard from '@/components/bundle/BundleCard';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import { getActiveBundles, calculateBundlePrice } from '@/services/bundle';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Комплекти товарів — вигідні набори',
  description:
    'Готові комплекти побутової хімії за зниженими цінами. Зберіть набір та заощадьте.',
  openGraph: {
    title: 'Комплекти товарів — вигідні набори',
    description:
      'Готові комплекти побутової хімії за зниженими цінами. Зберіть набір та заощадьте.',
    type: 'website',
    siteName: 'Порошок',
  },
};

export default async function BundlesPage() {
  const { bundles } = await getActiveBundles(1, 50);

  const bundlesWithPrices = await Promise.all(
    bundles.map(async (bundle) => {
      const pricing = await calculateBundlePrice(bundle.id);
      return { ...bundle, pricing };
    })
  );

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Комплекти' },
  ];

  return (
    <Container className="py-6">
      <BreadcrumbJsonLd
        items={breadcrumbs
          .filter((b) => b.href)
          .map((b) => ({ name: b.label, url: `${(process.env.APP_URL || 'http://localhost:3000')}${b.href}` }))}
      />
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <h1 className="mb-6 text-2xl font-bold">Комплекти товарів</h1>

      {bundlesWithPrices.length === 0 ? (
        <EmptyState
          title="Комплектів поки немає"
          description="Незабаром тут з'являться вигідні набори товарів"
          actionLabel="Перейти до каталогу"
          actionHref="/catalog"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bundlesWithPrices.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      )}
    </Container>
  );
}
