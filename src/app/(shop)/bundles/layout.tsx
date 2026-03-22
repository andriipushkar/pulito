import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s — Комплекти Порошок',
    default: 'Комплекти — Порошок',
  },
  description: 'Готові комплекти побутової хімії зі знижкою. Зберіть свій набір для прибирання, прання та догляду за домом.',
};

export default function BundlesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
