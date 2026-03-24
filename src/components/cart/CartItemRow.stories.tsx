import type { Meta, StoryObj } from '@storybook/react';
import CartItemRow from './CartItemRow';
import type { CartItem } from '@/providers/CartProvider';

const mockItem: CartItem = {
  productId: 1,
  name: 'Засіб для миття підлоги "Лимон" 1л',
  slug: 'zasib-dlya-mittya-pidlogy-limon-1l',
  code: 'CLN-101',
  priceRetail: 89.99,
  priceWholesale: 72.0,
  imagePath: null,
  quantity: 2,
  maxQuantity: 50,
};

const meta: Meta<typeof CartItemRow> = {
  title: 'Cart/CartItemRow',
  component: CartItemRow,
};
export default meta;
type Story = StoryObj<typeof CartItemRow>;

export const Default: Story = {
  args: {
    item: mockItem,
    onUpdateQuantity: (id, qty) => console.log('updateQuantity', id, qty),
    onRemove: (id) => console.log('remove', id),
  },
};

export const WithImage: Story = {
  args: {
    item: {
      ...mockItem,
      imagePath: 'https://placehold.co/80x80/e2e8f0/475569?text=Product',
    },
    onUpdateQuantity: (id, qty) => console.log('updateQuantity', id, qty),
    onRemove: (id) => console.log('remove', id),
  },
};

export const SingleQuantity: Story = {
  args: {
    item: { ...mockItem, quantity: 1 },
    onUpdateQuantity: (id, qty) => console.log('updateQuantity', id, qty),
    onRemove: (id) => console.log('remove', id),
  },
};
