import type { Meta, StoryObj } from '@storybook/react';
import SubscriptionCard from './SubscriptionCard';

const meta: Meta<typeof SubscriptionCard> = {
  title: 'Account/SubscriptionCard',
  component: SubscriptionCard,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof SubscriptionCard>;

const baseItems = [
  {
    id: 1,
    quantity: 2,
    product: {
      id: 101,
      name: 'Fairy Platinum Plus',
      code: 'FAIRY-001',
      priceRetail: 189.99,
      imagePath: null,
    },
  },
  {
    id: 2,
    quantity: 1,
    product: {
      id: 102,
      name: 'Persil Power Gel',
      code: 'PERSIL-002',
      priceRetail: 299.5,
      imagePath: null,
    },
  },
];

export const Active: Story = {
  args: {
    subscription: {
      id: 1,
      frequency: 'monthly',
      status: 'active',
      nextDeliveryAt: '2026-04-15',
      createdAt: '2026-01-10',
      items: baseItems,
    },
    onUpdate: () => console.log('onUpdate called'),
  },
};

export const Paused: Story = {
  args: {
    subscription: {
      id: 2,
      frequency: 'biweekly',
      status: 'paused',
      nextDeliveryAt: '2026-04-20',
      createdAt: '2025-12-05',
      items: baseItems,
    },
    onUpdate: () => console.log('onUpdate called'),
  },
};

export const Cancelled: Story = {
  args: {
    subscription: {
      id: 3,
      frequency: 'weekly',
      status: 'cancelled',
      nextDeliveryAt: '2026-03-01',
      createdAt: '2025-11-20',
      items: baseItems,
    },
    onUpdate: () => console.log('onUpdate called'),
  },
};
