import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { getPageBySlug } from '@/services/static-page';
import { sanitizeHtml } from '@/utils/sanitize';
import { getLocale } from 'next-intl/server';
import { applyTranslationsDeep, buildHreflang } from '@/lib/i18n';

interface StaticPageProps {
  params: Promise<{ slug: string }>;
}

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export async function generateMetadata({ params }: StaticPageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const raw = await getPageBySlug(slug);
  if (!raw) return { title: 'Сторінку не знайдено' };
  const page = applyTranslationsDeep(raw, locale)!;
  const canonical = `${baseUrl}/pages/${slug}`;
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    alternates: {
      canonical,
      languages: buildHreflang(`/pages/${slug}`),
    },
    openGraph: {
      title: page.seoTitle || page.title,
      description: page.seoDescription || undefined,
      url: canonical,
      siteName: 'Pulito Trade',
      type: 'article',
    },
  };
}

export default async function StaticPage({ params }: StaticPageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const raw = await getPageBySlug(slug);
  if (!raw) notFound();
  const page = applyTranslationsDeep(raw, locale)!;

  // Build breadcrumbs: home → parent (if any) → current. Parent link only
  // shown when this page is a child of another published page.
  const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Головна', href: '/' }];
  const pageWithRels = page as typeof page & {
    parent?: { id: number; title: string; slug: string } | null;
    children?: Array<{ id: number; title: string; slug: string }>;
  };
  if (pageWithRels.parent) {
    crumbs.push({ label: pageWithRels.parent.title, href: `/pages/${pageWithRels.parent.slug}` });
  }
  crumbs.push({ label: page.title });

  const children = pageWithRels.children ?? [];

  return (
    <Container className="py-6">
      <Breadcrumbs items={crumbs} className="mb-6" />

      <h1 className="mb-6 text-3xl font-bold">{page.title}</h1>

      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
      />

      {/* Sub-pages — shown only when the current page is a parent. Keeps the
          two-level page tree usable as a site-section index. */}
      {children.length > 0 && (
        <section className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h2 className="mb-4 text-lg font-semibold">У цьому розділі</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/pages/${child.slug}`}
                  className="block rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]"
                >
                  {child.title} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
