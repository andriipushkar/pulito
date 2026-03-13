import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мої замовлення',
  description: 'Перегляд історії замовлень та відстеження статусу доставки.',
  robots: { index: false, follow: false },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
