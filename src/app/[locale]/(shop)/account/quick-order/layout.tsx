import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Швидке замовлення',
  description: 'Оформлення замовлення за списком артикулів або завантаженням файлу.',
  robots: { index: false, follow: false },
};

export default function QuickOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
