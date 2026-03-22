import Skeleton from '@/components/ui/Skeleton';

export default function AccountLoading() {
  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      {/* Quick links grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-2xl p-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-4${
                i < 2 ? ' border-b border-[var(--color-border)]/60' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-1 h-3 w-16" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
