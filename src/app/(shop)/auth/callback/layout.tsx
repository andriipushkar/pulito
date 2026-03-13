import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Авторизація',
  description: 'Обробка авторизації через зовнішній сервіс.',
  robots: { index: false, follow: false },
};

export default function CallbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
