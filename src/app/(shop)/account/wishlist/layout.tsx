import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Список бажань',
  description: 'Збережені товари, які ви плануєте придбати пізніше.',
  robots: { index: false, follow: false },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
