import Container from '@/components/ui/Container';
import Skeleton from '@/components/ui/Skeleton';

export default function ProductLoading() {
  return (
    <Container className="py-6">
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-[var(--radius)]" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    </Container>
  );
}
