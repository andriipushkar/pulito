import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Менеджер',
  description: 'Контактна інформація вашого персонального менеджера.',
  robots: { index: false, follow: false },
};

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
