import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Оформлення замовлення',
  description:
    'Оформіть замовлення в інтернет-магазині Порошок: виберіть спосіб доставки та оплати.',
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
