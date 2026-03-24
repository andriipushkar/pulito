import type { Meta, StoryObj } from '@storybook/react';
import CartRecommendations from './CartRecommendations';

/**
 * CartRecommendations fetches product recommendations via API and uses useCart.
 * In Storybook it will show the loading/empty state unless API mocks are provided.
 */
const meta: Meta<typeof CartRecommendations> = {
  title: 'Cart/CartRecommendations',
  component: CartRecommendations,
};
export default meta;
type Story = StoryObj<typeof CartRecommendations>;

export const WithCartItems: Story = {
  args: {
    cartProductIds: [1, 2, 3],
  },
};

export const EmptyCart: Story = {
  args: {
    cartProductIds: [],
  },
};

export const SingleItem: Story = {
  args: {
    cartProductIds: [42],
  },
};
