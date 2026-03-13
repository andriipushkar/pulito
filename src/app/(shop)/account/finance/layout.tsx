import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Фінанси',
  description: 'Фінансова звітність, історія оплат та баланс рахунку.',
  robots: { index: false, follow: false },
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
