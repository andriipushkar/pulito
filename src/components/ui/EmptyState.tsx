import type { ReactNode } from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl bg-[var(--color-bg-secondary)]/40 py-16 text-center ${className}`}>
      {icon && (
        <div className="mb-4 text-[var(--color-text-secondary)]">{icon}</div>
      )}
      <h3 className="mb-2 text-lg font-semibold text-[var(--color-text)]">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-[var(--color-text-secondary)]">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="rounded-xl bg-[var(--color-text)] px-6 py-2.5 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-80"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
