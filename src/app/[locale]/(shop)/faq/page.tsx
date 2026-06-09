import type { Metadata } from 'next';

// ISR: revalidate FAQ every 5 minutes
export const revalidate = 300;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import FaqContent from '@/components/faq/FaqContent';
import FaqJsonLd from '@/components/faq/FaqJsonLd';
import { getPublishedFaq } from '@/services/faq';
import { getLocale, getTranslations } from 'next-intl/server';
import { applyTranslationsList, buildHreflang } from '@/lib/i18n';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Часті питання (FAQ)',
  description:
    'Відповіді на поширені питання про замовлення, доставку, оплату та повернення товарів.',
  alternates: {
    canonical: `${baseUrl}/faq`,
    languages: buildHreflang('/faq'),
  },
};

export default async function FaqPage() {
  const locale = await getLocale();
  const t = await getTranslations('faq');
  const tBc = await getTranslations('breadcrumb');
  const rawGrouped = await getPublishedFaq();
  // Localize each FAQ item within each category group; keys stay the same.
  const groupedFaq: typeof rawGrouped = {};
  for (const [cat, items] of Object.entries(rawGrouped)) {
    groupedFaq[cat] = applyTranslationsList(items, locale);
  }

  const allItems = Object.values(groupedFaq).flat();

  return (
    <Container className="py-6">
      <FaqJsonLd items={allItems} />

      <Breadcrumbs
        items={[{ label: tBc('home'), href: '/' }, { label: t('title') }]}
        className="mb-6"
      />

      <h1 className="mb-6 text-3xl font-bold">{t('title')}</h1>

      <FaqContent groupedFaq={groupedFaq} />
    </Container>
  );
}
