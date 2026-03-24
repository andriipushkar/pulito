import type { Meta, StoryObj } from '@storybook/react';
import SubscribeButton from './SubscribeButton';

const meta: Meta<typeof SubscribeButton> = {
  title: 'Product/SubscribeButton',
  component: SubscribeButton,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof SubscribeButton>;

export const Default: Story = {
  args: {
    productId: 1,
    productName: 'Premium Cleaning Powder 5kg',
    price: 450,
  },
};
