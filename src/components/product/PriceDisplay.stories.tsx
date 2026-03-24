import type { Meta, StoryObj } from '@storybook/react';
import PriceDisplay from './PriceDisplay';

const mockUseAuth = {
  user: null,
};

// Mock useAuth to avoid provider dependency
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
}));

const meta: Meta<typeof PriceDisplay> = {
  title: 'Product/PriceDisplay',
  component: PriceDisplay,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;
type Story = StoryObj<typeof PriceDisplay>;

export const Default: Story = {
  args: {
    priceRetail: 249.99,
    size: 'md',
  },
};

export const WithDiscount: Story = {
  args: {
    priceRetail: 199.99,
    priceRetailOld: 349.99,
    size: 'md',
  },
};

export const SmallSize: Story = {
  args: {
    priceRetail: 99.0,
    priceRetailOld: 150.0,
    size: 'sm',
  },
};

export const LargeSize: Story = {
  args: {
    priceRetail: 1299.0,
    size: 'lg',
  },
};
