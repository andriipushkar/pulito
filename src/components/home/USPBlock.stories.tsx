import type { Meta, StoryObj } from '@storybook/react';
import USPBlock from './USPBlock';

const meta: Meta<typeof USPBlock> = {
  title: 'Home/USPBlock',
  component: USPBlock,
};
export default meta;
type Story = StoryObj<typeof USPBlock>;

export const Default: Story = {
  args: {},
};

export const CustomItems: Story = {
  args: {
    items: [
      { icon: 'truck', title: 'Доставка за 24 години', description: 'Експрес-доставка по Київу' },
      { icon: 'shield', title: '100% оригінал', description: 'Пряма закупка від виробника' },
      { icon: 'money', title: 'Знижки до 50%', description: 'Регулярні акції для клієнтів' },
    ],
  },
};

export const SingleItem: Story = {
  args: {
    items: [{ icon: 'phone', title: 'Підтримка 24/7', description: 'Завжди на звязку' }],
  },
};
