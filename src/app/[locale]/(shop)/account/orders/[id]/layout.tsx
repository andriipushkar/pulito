import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Деталі замовлення',
  description: 'Детальна інформація про замовлення, статус оплати та доставки.',
  robots: { index: false, follow: false },
};

export default function OrderDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
