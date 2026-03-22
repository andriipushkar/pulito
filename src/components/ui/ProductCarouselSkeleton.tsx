import Skeleton from '@/components/ui/Skeleton';

export default function ProductCarouselSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 h-6 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-transparent">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3">
              <Skeleton className="mb-2 h-3 w-16" />
              <Skeleton className="mb-1 h-4 w-full" />
              <Skeleton className="mb-3 h-4 w-3/4" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
