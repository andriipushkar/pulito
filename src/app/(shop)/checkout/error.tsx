'use client';

import Container from '@/components/ui/Container';

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 text-4xl font-bold text-[var(--color-danger)]">Помилка</h1>
        <p className="mb-6 text-[var(--color-text-secondary)]">
          {error.message || 'Щось пішло не так. Спробуйте пізніше.'}
        </p>
        <button
          onClick={reset}
          className="rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-3 text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Спробувати знову
        </button>
      </div>
    </Container>
  );
}
