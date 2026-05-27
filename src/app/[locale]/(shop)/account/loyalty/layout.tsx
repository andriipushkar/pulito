import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Програма лояльності',
  description: 'Бонусна програма: ваш рівень, накопичені бали та історія транзакцій.',
  robots: { index: false, follow: false },
};

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
