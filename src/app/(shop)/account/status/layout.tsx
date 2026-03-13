import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мої умови',
  description: 'Ваш статус клієнта та індивідуальні умови співпраці.',
  robots: { index: false, follow: false },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
