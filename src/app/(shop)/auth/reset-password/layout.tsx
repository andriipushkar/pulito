import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Скидання пароля',
  description: 'Встановіть новий пароль для вашого акаунту в інтернет-магазині Порошок.',
  robots: { index: false, follow: true },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
