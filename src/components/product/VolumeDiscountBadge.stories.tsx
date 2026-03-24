import type { Meta, StoryObj } from '@storybook/react';
import VolumeDiscountBadge from './VolumeDiscountBadge';

const meta: Meta<typeof VolumeDiscountBadge> = {
  title: 'Product/VolumeDiscountBadge',
  component: VolumeDiscountBadge,
  parameters: {
    // The component fetches from API; stories will render the empty state
    // unless msw or a mock is used. Shown here for structure.
    mockData: [
      {
        url: '/api/v1/volume-discounts?productId=1',
        method: 'GET',
        status: 200,
        response: {
          success: true,
          data: [
            {
              id: 1,
              minQuantity: 5,
              maxQuantity: 20,
              discountPercent: 10,
              discountType: 'percentage',
            },
          ],
        },
      },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof VolumeDiscountBadge>;

export const Default: Story = {
  args: {
    productId: 1,
    categoryId: null,
  },
};

export const WithCategory: Story = {
  args: {
    productId: 42,
    categoryId: 5,
  },
};
