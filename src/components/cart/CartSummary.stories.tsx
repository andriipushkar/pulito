import type { Meta, StoryObj } from '@storybook/react';
import CartSummary from './CartSummary';

const meta: Meta<typeof CartSummary> = {
  title: 'Cart/CartSummary',
  component: CartSummary,
};
export default meta;
type Story = StoryObj<typeof CartSummary>;

export const Default: Story = {
  args: {
    itemCount: 3,
    total: 567.97,
  },
};

export const Disabled: Story = {
  args: {
    itemCount: 1,
    total: 25.0,
    isCheckoutDisabled: true,
    disabledReason: 'Мінімальна сума замовлення — 100 ₴',
  },
};

export const LargeOrder: Story = {
  args: {
    itemCount: 15,
    total: 24999.5,
  },
};
