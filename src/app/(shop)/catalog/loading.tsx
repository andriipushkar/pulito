import Container from '@/components/ui/Container';
import Skeleton from '@/components/ui/Skeleton';
import ProductCardSkeleton from '@/components/product/ProductCardSkeleton';

export default function CatalogLoading() {
  return (
    <Container className="py-6">
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-6 h-8 w-64" />
      <Skeleton className="mb-4 h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
