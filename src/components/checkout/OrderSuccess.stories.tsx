import type { Meta, StoryObj } from '@storybook/react';
import OrderSuccess from './OrderSuccess';

const meta: Meta<typeof OrderSuccess> = {
  title: 'Checkout/OrderSuccess',
  component: OrderSuccess,
};
export default meta;
type Story = StoryObj<typeof OrderSuccess>;

export const Default: Story = {
  args: {
    orderNumber: 'CS-20260324-0042',
  },
};

export const ShortNumber: Story = {
  args: {
    orderNumber: '1001',
  },
};
