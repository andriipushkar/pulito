import { Link } from '@/i18n/navigation';
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  searchParams = {},
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  function buildUrl(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    return `${baseUrl}?${params.toString()}`;
  }

  const pages: (number | '...')[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  const linkClass =
    'flex h-9 min-w-9 items-center justify-center rounded-[var(--radius)] px-3 text-sm transition-colors';

  return (
    <>
      {currentPage > 1 && <link rel="prev" href={buildUrl(currentPage - 1)} />}
      {currentPage < totalPages && <link rel="next" href={buildUrl(currentPage + 1)} />}
      <nav aria-label="Пагінація" className={`flex items-center justify-center gap-1 ${className}`}>
        {currentPage > 1 && (
          <Link
            href={buildUrl(currentPage - 1)}
            className={`${linkClass} border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]`}
            aria-label="Попередня сторінка"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-[var(--color-text-secondary)]">
              ...
            </span>
          ) : (
            <Link
              key={p}
              href={buildUrl(p)}
              className={`${linkClass} ${
                p === currentPage
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
              }`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </Link>
          ),
        )}
        {currentPage < totalPages && (
          <Link
            href={buildUrl(currentPage + 1)}
            className={`${linkClass} border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]`}
            aria-label="Наступна сторінка"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </nav>
    </>
  );
}
