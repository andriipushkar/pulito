import type { Meta, StoryObj } from '@storybook/react';
import BundlePriceSummary from './BundlePriceSummary';

const meta: Meta<typeof BundlePriceSummary> = {
  title: 'Bundle/BundlePriceSummary',
  component: BundlePriceSummary,
};
export default meta;
type Story = StoryObj<typeof BundlePriceSummary>;

export const WithDiscount: Story = {
  args: {
    originalPrice: 1200.0,
    finalPrice: 999.0,
    savings: 201.0,
  },
};

export const NoDiscount: Story = {
  args: {
    originalPrice: 500.0,
    finalPrice: 500.0,
    savings: 0,
  },
};

export const LargeDiscount: Story = {
  args: {
    originalPrice: 5000.0,
    finalPrice: 3250.0,
    savings: 1750.0,
  },
};
