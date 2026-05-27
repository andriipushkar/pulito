import Skeleton from '@/components/ui/Skeleton';

export default function CartLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="mb-6 h-4 w-40" />
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="gap-8 lg:grid lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 border-b border-[var(--color-border)] py-4">
              <Skeleton className="h-20 w-20 rounded-[var(--radius)]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-60 rounded-[var(--radius)]" />
      </div>
    </div>
  );
}
