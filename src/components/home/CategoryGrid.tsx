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
  const cls = "h-14 w-14";
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
    .slice(0, 6);

  if (displayCategories.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="relative text-xl font-extrabold text-[var(--color-text)] sm:text-2xl">
          Категорії
          <span className="absolute -bottom-1 left-0 h-0.5 w-12 rounded-full bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-light)]" />
        </h2>
        <Link
          href="/catalog"
          className="text-sm font-medium text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-dark)]"
        >
          Усі категорії &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {displayCategories.map((cat, idx) => {
          const bg = categoryBgs[idx % categoryBgs.length];
          return (
            <Link
              key={cat.id}
              href={`/catalog?category=${cat.slug}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--color-primary-light)] hover:shadow-[var(--shadow-brand-lg)]"
            >
              <div className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl ${bg} text-[var(--color-primary)] shadow-[var(--shadow)] transition-transform duration-300 group-hover:scale-110`}>
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
                <h3 className="text-sm font-semibold text-[var(--color-text)]">{cat.name}</h3>
                <span className="mt-1 inline-block rounded-full bg-[var(--color-primary-50)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-primary)]">
                  {cat._count.products} товарів
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
