import Skeleton from '@/components/ui/Skeleton';

export default function ReviewSectionSkeleton() {
  return (
    <div className="mt-10">
      <Skeleton className="mb-4 h-7 w-36" />
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div>
          <Skeleton className="mb-1 h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)]/60 p-4">
            <div className="mb-2 flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="mb-1 h-4 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-1 h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
