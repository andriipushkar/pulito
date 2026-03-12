import type { Metadata } from 'next';

// ISR: revalidate FAQ every 5 minutes
export const revalidate = 300;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import FaqContent from '@/components/faq/FaqContent';
import FaqJsonLd from '@/components/faq/FaqJsonLd';
import { getPublishedFaq } from '@/services/faq';

export const metadata: Metadata = {
  title: 'Часті питання (FAQ)',
  description: 'Відповіді на поширені питання про замовлення, доставку, оплату та повернення товарів.',
};

export default async function FaqPage() {
  const groupedFaq = await getPublishedFaq();

  const allItems = Object.values(groupedFaq).flat();

  return (
    <Container className="py-6">
      <FaqJsonLd items={allItems} />

      <Breadcrumbs
        items={[
          { label: 'Головна', href: '/' },
          { label: 'FAQ' },
        ]}
        className="mb-6"
      />

      <h1 className="mb-6 text-3xl font-bold">Часті питання</h1>

      <FaqContent groupedFaq={groupedFaq} />
    </Container>
  );
}
