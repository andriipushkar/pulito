import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Відновлення пароля',
  description:
    'Відновіть пароль до свого акаунту в інтернет-магазині Порошок. Введіть email для отримання інструкцій.',
  robots: { index: false, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
