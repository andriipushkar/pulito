import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s — Блог Порошок',
    default: 'Блог — Порошок',
  },
  description: 'Корисні статті про побутову хімію, поради з прибирання та прання, порівняння засобів.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
