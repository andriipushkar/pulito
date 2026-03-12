import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ComparisonTable from '@/components/product/ComparisonTable';

export const metadata: Metadata = {
  title: 'Порівняння товарів',
  description: 'Порівняйте характеристики товарів побутової хімії.',
};

export default function ComparisonPage() {
  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Порівняння товарів' },
  ];

  return (
    <Container className="py-6">
      <Breadcrumbs items={breadcrumbs} className="mb-4" />
      <h1 className="mb-6 text-2xl font-bold">Порівняння товарів</h1>
      <ComparisonTable />
    </Container>
  );
}
