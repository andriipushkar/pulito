import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мої адреси',
  description: 'Керування адресами доставки для швидкого оформлення замовлень.',
  robots: { index: false, follow: false },
};

export default function AddressesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
