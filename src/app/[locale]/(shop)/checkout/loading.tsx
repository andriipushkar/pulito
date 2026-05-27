import Skeleton from '@/components/ui/Skeleton';

export default function CheckoutLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-6 h-4 w-60" />
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="mb-8 flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-96 rounded-[var(--radius)]" />
    </div>
  );
}
