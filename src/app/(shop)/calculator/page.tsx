import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import CalculatorClient from './calculator-client';

export const metadata: Metadata = {
  title: 'Калькулятор витрат на побутову хімію',
  description:
    'Розрахуйте скільки побутової хімії потрібно вашій сім\'ї на місяць. Порошок, кондиціонер, засоби для миття — персональні рекомендації з цінами.',
  openGraph: {
    title: 'Калькулятор витрат на побутову хімію — Порошок',
    description: 'Дізнайтеся скільки коштує побутова хімія для вашої сім\'ї на місяць.',
  },
};

const calculatorJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Як розрахувати витрати на побутову хімію',
  description: 'Калькулятор допоможе визначити потреби вашої сім\'ї у побутовій хімії та розрахувати щомісячні витрати.',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Вкажіть розмір сім\'ї',
      text: 'Оберіть кількість членів вашої сім\'ї від 1 до 8.',
    },
    {
      '@type': 'HowToStep',
      name: 'Вкажіть кількість прань',
      text: 'Оберіть скільки разів на тиждень ви запускаєте пральну машину.',
    },
    {
      '@type': 'HowToStep',
      name: 'Оберіть частоту прибирання',
      text: 'Вкажіть як часто ви робите прибирання: щодня, раз на тиждень або раз на два тижні.',
    },
    {
      '@type': 'HowToStep',
      name: 'Отримайте рекомендації',
      text: 'Система підбере оптимальні товари та розрахує витрати на місяць і квартал.',
    },
  ],
};

export default function CalculatorPage() {
  return (
    <Container className="py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorJsonLd) }}
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            Калькулятор витрат на побутову хімію
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Дізнайтеся скільки побутової хімії потрібно вашій сім&apos;ї та скільки це коштує
          </p>
        </div>

        <CalculatorClient />
      </div>
    </Container>
  );
}
