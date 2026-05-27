import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s — Блог Pulito Trade',
    default: 'Блог — Pulito Trade',
  },
  description:
    'Корисні статті про побутову хімію, поради з прибирання та прання, порівняння засобів.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
