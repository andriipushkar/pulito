import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Вхід',
  description:
    'Увійдіть до свого акаунту в інтернет-магазині Pulito Trade для оформлення замовлень та перегляду історії покупок.',
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
