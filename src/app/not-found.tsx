import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Search, Home } from '@/components/icons';

const RecentlyViewedSection = dynamic(() => import('@/components/product/RecentlyViewedSection'));

const popularCategories = [
  { name: 'Засоби для прання', href: '/catalog/zasoby-dlya-prannya' },
  { name: 'Засоби для миття посуду', href: '/catalog/zasoby-dlya-myttya-posudu' },
  { name: 'Засоби для прибирання', href: '/catalog/zasoby-dlya-prybyrannya' },
  { name: 'Засоби для ванної', href: '/catalog/zasoby-dlya-vannoyi' },
  { name: 'Засоби для кухні', href: '/catalog/zasoby-dlya-kukhni' },
  { name: 'Освіжувачі повітря', href: '/catalog/osvizhuvachi-povitrya' },
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="mb-2 text-6xl font-bold text-[var(--color-primary)]">404</h1>
      <p className="mb-6 text-xl text-[var(--color-text-secondary)]">Сторінку не знайдено</p>

      <form action="/catalog" method="GET" className="mb-8 flex w-full max-w-md">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
          />
          <input
            type="text"
            name="search"
            placeholder="Пошук товарів..."
            aria-label="Пошук товарів"
            className="w-full rounded-l-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[var(--color-primary)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-r-[var(--radius)] bg-[var(--color-primary)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Знайти
        </button>
      </form>

      <div className="mb-8 w-full max-w-md">
        <h2 className="mb-3 text-center text-sm font-semibold text-[var(--color-text-secondary)]">
          Популярні категорії
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {popularCategories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-3 text-white transition-colors hover:bg-[var(--color-primary-dark)]"
      >
        <Home size={18} />
        На головну
      </Link>

      <div className="mt-12 w-full max-w-5xl">
        <RecentlyViewedSection />
      </div>
    </main>
  );
}
