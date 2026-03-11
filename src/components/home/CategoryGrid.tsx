import Link from 'next/link';
import type { CategoryListItem } from '@/types/category';

interface CategoryGridProps {
  categories: CategoryListItem[];
}

const categoryBgs = [
  'bg-gradient-to-br from-blue-50 to-blue-100',
  'bg-gradient-to-br from-sky-50 to-sky-100',
  'bg-gradient-to-br from-blue-50 to-indigo-100',
  'bg-gradient-to-br from-cyan-50 to-blue-100',
  'bg-gradient-to-br from-blue-50 to-sky-100',
  'bg-gradient-to-br from-indigo-50 to-blue-100',
];

function CategoryIcon({ index }: { index: number }) {
  const cls = "h-8 w-8 sm:h-10 sm:w-10";
  switch (index % 6) {
    case 0: // spray
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3v2.25M9.75 3H7.5v2.25m2.25-2.25h2.25v2.25M7.5 5.25h4.5v1.5a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-1.5zM9 10.5v10.5a1.5 1.5 0 001.5 1.5h0a1.5 1.5 0 001.5-1.5V10.5m-3 0h3m-3 0a1.5 1.5 0 00-1.5 1.5v0m4.5-1.5a1.5 1.5 0 011.5 1.5v0M5 3.75h.5M5 2h.5M3.5 3h.5M15 3h1.5M15.5 1.5h1M17 2.5h.5" />
        </svg>
      );
    case 1: // soap/bubbles
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a6 6 0 006-6v-1.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 01-.75-.75V9a3 3 0 00-6 0v3.25a.75.75 0 01-.75.75h-1.5a.75.75 0 00-.75.75V15a6 6 0 006 6z" />
          <circle cx="17" cy="5" r="1.5" />
          <circle cx="20" cy="8" r="1" />
        </svg>
      );
    case 2: // washing machine
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <circle cx="12" cy="14" r="5" />
          <path strokeLinecap="round" d="M9 14c0-1.5 1.5-2.5 3-1.5s3 0 3-1.5" />
          <circle cx="8" cy="5.5" r="0.75" fill="currentColor" />
          <circle cx="11" cy="5.5" r="0.75" fill="currentColor" />
        </svg>
      );
    case 3: // dishes/plate
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 010-18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 000-18" />
          <ellipse cx="12" cy="12" rx="5" ry="2.5" />
          <path strokeLinecap="round" d="M19 4l1 7-1 1M5 4L4 11l1 1" />
        </svg>
      );
    case 4: // broom/mop
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10m0 0l-3 1v6a1 1 0 001 1h4a1 1 0 001-1v-6l-3-1z" />
          <path strokeLinecap="round" d="M8 22h8M9 16h6" />
        </svg>
      );
    default: // sparkle/clean
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      );
  }
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  const displayCategories = categories
    .filter((c) => !c.parentId && c.isVisible)
    .slice(0, 8);

  if (displayCategories.length === 0) return null;

  return (
    <section className="lg:hidden">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h2 className="relative text-lg font-bold tracking-tight text-[var(--color-text)] sm:text-2xl">
          Категорії
          <span className="absolute -bottom-1 left-0 h-0.5 w-10 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]" />
        </h2>
        <Link
          href="/catalog"
          className="text-xs font-semibold text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-dark)] sm:text-sm"
        >
          Усi &rarr;
        </Link>
      </div>

      {/* Mobile: horizontal scroll stories */}
      <div className="-mx-4 px-4 sm:hidden">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {displayCategories.map((cat, idx) => {
            const bg = categoryBgs[idx % categoryBgs.length];
            return (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 active:scale-95"
              >
                <div className={`flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[22px] ${bg} text-[var(--color-primary)] shadow-[var(--shadow)] ring-2 ring-white transition-transform duration-200`}>
                  {cat.coverImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cat.coverImage}
                      alt={cat.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <CategoryIcon index={idx} />
                  )}
                </div>
                <span className="line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight text-[var(--color-text)]">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Desktop: horizontal scroll like mobile but bigger */}
      <div className="-mx-6 hidden px-6 sm:block lg:-mx-8 lg:px-8">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {displayCategories.map((cat, idx) => {
            const bg = categoryBgs[idx % categoryBgs.length];
            return (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="group flex w-[120px] shrink-0 flex-col items-center gap-2 transition-transform duration-200 hover:-translate-y-1 lg:w-[130px]"
              >
                <div className={`flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[22px] ${bg} text-[var(--color-primary)] shadow-[var(--shadow)] ring-2 ring-white transition-transform duration-200 group-hover:scale-105 lg:h-[96px] lg:w-[96px]`}>
                  {cat.coverImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cat.coverImage}
                      alt={cat.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <CategoryIcon index={idx} />
                  )}
                </div>
                <div className="text-center">
                  <h3 className="line-clamp-2 text-xs font-bold leading-tight text-[var(--color-text)] lg:text-sm">{cat.name}</h3>
                  <span className="mt-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                    {cat._count.products} товарів
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
