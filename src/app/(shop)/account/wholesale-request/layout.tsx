import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Стати оптовиком',
  description: 'Подайте заявку на оптове обслуговування та отримуйте спеціальні ціни.',
  robots: { index: false, follow: false },
};

export default function WholesaleRequestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
