import Skeleton from '@/components/ui/Skeleton';

export default function AdminLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-36" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-20 rounded-[var(--radius)]" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius)] border border-[var(--color-border)] p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-8 w-20" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Widget panels */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] p-5">
          <Skeleton className="mb-4 h-4 w-28" />
          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
