import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Кошик',
  description: 'Перегляд товарів у кошику та оформлення замовлення в інтернет-магазині Порошок.',
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
