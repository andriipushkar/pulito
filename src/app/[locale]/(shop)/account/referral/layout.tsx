import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Реферальна програма',
  description: 'Запрошуйте друзів та отримуйте бонуси за кожного нового покупця.',
  robots: { index: false, follow: false },
};

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return children;
}
