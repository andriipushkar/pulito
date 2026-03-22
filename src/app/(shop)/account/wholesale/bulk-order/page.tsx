import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import BulkOrderForm from '@/components/wholesale/BulkOrderForm';

export const metadata: Metadata = {
  title: 'Оптове замовлення по артикулах',
};

export default function BulkOrderPage() {
  return (
    <Container className="py-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-text)]">
          Оптове замовлення по артикулах
        </h1>
        <p className="mb-6 text-[var(--color-text-secondary)]">
          Введіть артикули товарів та кількість для швидкого оформлення оптового замовлення
        </p>
        <BulkOrderForm />
      </div>
    </Container>
  );
}
