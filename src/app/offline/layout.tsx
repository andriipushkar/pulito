import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Офлайн-режим',
  description: 'Немає зʼєднання з інтернетом. Перевірте підключення та спробуйте знову.',
  robots: { index: false, follow: false },
};

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
