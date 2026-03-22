import type { Meta, StoryObj } from '@storybook/react';
import SocialProof from './SocialProof';

const meta: Meta<typeof SocialProof> = {
  title: 'Product/SocialProof',
  component: SocialProof,
};

export default meta;
type Story = StoryObj<typeof SocialProof>;

export const Popular: Story = {
  args: { productId: 1, ordersCount: 150, viewsCount: 5000 },
};

export const Moderate: Story = {
  args: { productId: 2, ordersCount: 25, viewsCount: 800 },
};

export const New: Story = {
  args: { productId: 3, ordersCount: 2, viewsCount: 50 },
};
