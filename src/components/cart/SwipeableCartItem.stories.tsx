import type { Meta, StoryObj } from '@storybook/react';
import SwipeableCartItem from './SwipeableCartItem';

const meta: Meta<typeof SwipeableCartItem> = {
  title: 'Cart/SwipeableCartItem',
  component: SwipeableCartItem,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};

export default meta;
type Story = StoryObj<typeof SwipeableCartItem>;

export const Default: Story = {
  args: {
    onDelete: () => console.log('Item deleted'),
    children: (
      <div className="flex items-center gap-4 p-4">
        <div className="h-16 w-16 rounded-lg bg-gray-200" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Fairy Platinum Plus 1L</p>
          <p className="text-xs text-gray-500">x2</p>
          <p className="text-sm font-bold">379.98 ₴</p>
        </div>
      </div>
    ),
  },
};

export const LongProductName: Story = {
  args: {
    onDelete: () => console.log('Item deleted'),
    children: (
      <div className="flex items-center gap-4 p-4">
        <div className="h-16 w-16 rounded-lg bg-gray-200" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Persil Power Gel Universal Deep Clean 2L (Подарункова упаковка)</p>
          <p className="text-xs text-gray-500">x1</p>
          <p className="text-sm font-bold">299.50 ₴</p>
        </div>
      </div>
    ),
  },
};
