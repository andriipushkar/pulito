import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s — Комплекти Pulito Trade',
    default: 'Комплекти — Pulito Trade',
  },
  description:
    'Готові комплекти побутової хімії зі знижкою. Зберіть свій набір для прибирання, прання та догляду за домом.',
};

export default function BundlesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
