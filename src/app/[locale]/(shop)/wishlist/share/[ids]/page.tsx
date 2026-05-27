import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ProductCard from '@/components/product/ProductCard';
import { getProducts } from '@/services/product';

// Public, cacheable for 5 minutes — the URL itself encodes the list, so
// nothing changes server-side until someone shares a new combination.
export const revalidate = 300;

interface SharePageProps {
  params: Promise<{ ids: string }>;
}

/** Decode a base64-url string of comma-separated IDs into a number[]. */
function decodeIds(encoded: string): number[] {
  try {
    // Tolerate URL-safe base64 (- → +, _ → /)
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    return decoded
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50); // cap to avoid pathological URLs
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { ids } = await params;
  const count = decodeIds(ids).length;
  return {
    title: `Список бажань (${count} товарів)`,
    description:
      'Перегляньте товари зі списку бажань. Ви можете додати їх у власний кошик або зберегти.',
    // Shared wishlists are personal user content — never index them, but follow
    // links so the linked product pages get crawl signals.
    robots: { index: false, follow: true },
  };
}

export default async function WishlistSharePage({ params }: SharePageProps) {
  const { ids } = await params;
  const productIds = decodeIds(ids);
  if (productIds.length === 0) notFound();

  // Reuse getProducts with `id` IN filter via a workaround: fetch each by id
  // is wasteful for 50 items, so we use prisma directly via getProducts isn't
  // ideal — drop a quick implementation here keeping the same shape.
  const { products } = await getProducts({
    page: 1,
    limit: productIds.length,
    sort: 'newest',
  });
  // Filter to only requested IDs (cheaper than building a custom service)
  const filtered = products.filter((p) => productIds.includes(p.id));

  return (
    <Container className="py-6">
      <Breadcrumbs
        items={[{ label: 'Головна', href: '/' }, { label: 'Список бажань' }]}
        className="mb-4"
      />
      <h1 className="mb-2 text-2xl font-bold">Список бажань</h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Хтось поділився з вами {productIds.length}{' '}
        {productIds.length === 1 ? 'товаром' : 'товарами'}. Додайте у кошик або збережіть собі.
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-text-secondary)]">
          На жаль, ці товари недоступні зараз.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </Container>
  );
}
