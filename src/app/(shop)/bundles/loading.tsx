import Container from '@/components/ui/Container';
import Skeleton from '@/components/ui/Skeleton';

export default function BundlesLoading() {
  return (
    <Container className="py-6">
      {/* Breadcrumbs */}
      <Skeleton className="mb-4 h-4 w-40" />

      {/* Title */}
      <Skeleton className="mb-6 h-8 w-56" />

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60"
          >
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="p-4">
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton className="mb-3 h-3 w-full" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
