import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ComparisonTable from '@/components/product/ComparisonTable';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Порівняння товарів',
  description: 'Порівняйте характеристики товарів побутової хімії.',
  alternates: {
    canonical: `${baseUrl}/comparison`,
    languages: {
      'uk': `${baseUrl}/comparison`,
      'en': `${baseUrl}/en/comparison`,
      'x-default': `${baseUrl}/comparison`,
    },
  },
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
