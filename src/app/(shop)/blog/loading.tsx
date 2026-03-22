import Container from '@/components/ui/Container';
import Skeleton from '@/components/ui/Skeleton';

export default function BlogLoading() {
  return (
    <Container className="py-6">
      {/* Breadcrumbs skeleton */}
      <Skeleton className="mb-4 h-4 w-48" />

      {/* Title skeleton */}
      <Skeleton className="mb-6 h-8 w-64" />

      {/* Category tabs skeleton */}
      <div className="mb-8 flex gap-2 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Blog cards grid skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]"
          >
            <Skeleton className="aspect-video w-full" />
            <div className="p-4">
              <div className="mb-2 flex gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="mb-2 h-6 w-full" />
              <Skeleton className="mb-1 h-4 w-full" />
              <Skeleton className="mb-4 h-4 w-3/4" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
