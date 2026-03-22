import Skeleton from '@/components/ui/Skeleton';

export default function OrdersLoading() {
  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-1 h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-44 rounded-[var(--radius)]" />
      </div>

      {/* Orders count */}
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-5 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Orders list */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`p-4${i < 4 ? ' border-b border-[var(--color-border)]/60' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-1 h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
