import Container from '@/components/ui/Container';
import Skeleton from '@/components/ui/Skeleton';

export default function HomeLoading() {
  return (
    <Container className="py-4 sm:py-6 lg:py-8">
      <div className="space-y-6 sm:space-y-8 lg:space-y-12">
        {/* Banner */}
        <Skeleton className="aspect-[5/2] w-full rounded-3xl" />

        {/* USP — mobile only */}
        <div className="flex gap-2.5 overflow-hidden lg:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-[140px] shrink-0 rounded-2xl sm:h-[100px] sm:w-[180px]" />
          ))}
        </div>

        {/* Categories — mobile only */}
        <div className="lg:hidden">
          <Skeleton className="mb-3 h-6 w-28" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] rounded-xl" />
            ))}
          </div>
        </div>

        {/* Product carousel */}
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

        {/* Brands */}
        <div>
          <Skeleton className="mb-3 h-6 w-32" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] w-[100px] shrink-0 rounded-xl sm:w-[116px]" />
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
