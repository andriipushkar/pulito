import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Сповіщення',
  description: 'Перегляд сповіщень про замовлення, акції та оновлення.',
  robots: { index: false, follow: false },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
