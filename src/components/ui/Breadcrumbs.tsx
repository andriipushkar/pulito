import { Link } from '@/i18n/navigation';
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href
        ? {
            item: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://pulito.trade'}${item.href}`,
          }
        : {}),
    })),
  };

  const separator = (
    <svg
      className="h-4 w-4 text-[var(--color-text-secondary)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );

  const renderItem = (item: BreadcrumbItem, i: number) =>
    item.href && i < items.length - 1 ? (
      <Link
        href={item.href}
        className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
      >
        {item.label}
      </Link>
    ) : (
      <span className="text-[var(--color-text)]">{item.label}</span>
    );

  const showMobileShortened = items.length > 3;

  // Mobile shortened: first item → ... → last two items
  const mobileItems = showMobileShortened ? [items[0], ...items.slice(-2)] : items;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Навігація" className={`text-sm ${className}`}>
        {/* Desktop: all items */}
        <ol className="hidden sm:flex flex-wrap items-center gap-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && separator}
              {renderItem(item, i)}
            </li>
          ))}
        </ol>

        {/* Mobile: shortened when > 3 items */}
        <ol className="flex sm:hidden flex-wrap items-center gap-1">
          {showMobileShortened ? (
            <>
              <li className="flex items-center gap-1">{renderItem(mobileItems[0], 0)}</li>
              <li className="flex items-center gap-1">
                {separator}
                <span className="text-[var(--color-text-secondary)]">&hellip;</span>
              </li>
              {mobileItems.slice(1).map((item, i) => {
                const originalIndex = items.length - 2 + i;
                return (
                  <li key={originalIndex} className="flex items-center gap-1">
                    {separator}
                    {renderItem(item, originalIndex)}
                  </li>
                );
              })}
            </>
          ) : (
            items.map((item, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && separator}
                {renderItem(item, i)}
              </li>
            ))
          )}
        </ol>
      </nav>
    </>
  );
}
