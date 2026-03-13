import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Підтвердження email',
  description: 'Підтвердження електронної адреси для акаунту в інтернет-магазині Порошок.',
  robots: { index: false, follow: true },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
