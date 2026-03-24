import type { Meta, StoryObj } from '@storybook/react';
import FaqContent from './FaqContent';

const meta: Meta<typeof FaqContent> = {
  title: 'FAQ/FaqContent',
  component: FaqContent,
};
export default meta;
type Story = StoryObj<typeof FaqContent>;

const sampleGroupedFaq = {
  Доставка: [
    {
      id: 1,
      question: 'Скільки коштує доставка?',
      answer: 'Безкоштовна доставка при замовленні від 500 грн. Для менших замовлень — 50 грн.',
      category: 'Доставка',
    },
    {
      id: 2,
      question: 'Як довго чекати на доставку?',
      answer: 'Доставка по Україні займає 1-3 робочих дні.',
      category: 'Доставка',
    },
  ],
  Оплата: [
    {
      id: 3,
      question: 'Які способи оплати доступні?',
      answer: 'Ви можете оплатити картою, накладеним платежем або через PrivatPay.',
      category: 'Оплата',
    },
    {
      id: 4,
      question: 'Чи можна оплатити при отриманні?',
      answer: 'Так, ви можете оплатити накладеним платежем при отриманні на Новій Пошті.',
      category: 'Оплата',
    },
  ],
  Повернення: [
    {
      id: 5,
      question: 'Як повернути товар?',
      answer:
        'Ви можете повернути товар протягом 14 днів з моменту отримання. Товар має бути в оригінальній упаковці.',
      category: 'Повернення',
    },
  ],
};

export const Default: Story = {
  args: {
    groupedFaq: sampleGroupedFaq,
  },
};

export const SingleCategory: Story = {
  args: {
    groupedFaq: {
      Доставка: sampleGroupedFaq['Доставка'],
    },
  },
};

export const Empty: Story = {
  args: {
    groupedFaq: {},
  },
};
