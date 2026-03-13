import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Реєстрація',
  description:
    'Створіть акаунт в інтернет-магазині Порошок, щоб відстежувати замовлення, зберігати адреси та отримувати персональні знижки.',
  robots: { index: false, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
