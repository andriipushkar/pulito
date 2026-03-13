import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Обробка оплати',
  description: 'Обробка платежу та підтвердження замовлення.',
  robots: { index: false, follow: false },
};

export default function PaymentRedirectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
