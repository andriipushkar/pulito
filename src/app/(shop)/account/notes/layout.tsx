import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Нотатки',
  description: 'Ваші нотатки до товарів та замовлень.',
  robots: { index: false, follow: false },
};

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
