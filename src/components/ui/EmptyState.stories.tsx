import type { Meta, StoryObj } from '@storybook/react';
import EmptyState from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'Кошик порожній',
    description: 'Додайте товари до кошика, щоб оформити замовлення.',
    actionLabel: 'Перейти до каталогу',
    actionHref: '/catalog',
  },
};

export const WithIcon: Story = {
  args: {
    icon: (
      <svg
        className="h-12 w-12"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
    title: 'Нічого не знайдено',
    description: 'Спробуйте змінити пошуковий запит або параметри фільтрів.',
  },
};

export const Minimal: Story = {
  args: {
    title: 'Немає замовлень',
  },
};
