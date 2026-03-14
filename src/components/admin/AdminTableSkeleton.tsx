import Skeleton from '@/components/ui/Skeleton';

interface AdminTableSkeletonProps {
  rows?: number;
  columns?: number;
}

export default function AdminTableSkeleton({ rows = 8, columns = 6 }: AdminTableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={`h-4 flex-1 ${colIdx === 0 ? 'max-w-[200px]' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AdminStatsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-[var(--color-bg-secondary)] px-4 py-3">
          <Skeleton className="mb-2 h-8 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function AdminFormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
      <Skeleton className="mb-6 h-6 w-40" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-3 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
