import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Прайс-лист',
  description: 'Завантажте актуальний прайс-лист з цінами на побутову хімію.',
  robots: { index: false, follow: false },
};

export default function PricelistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
