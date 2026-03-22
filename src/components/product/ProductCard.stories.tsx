import type { Meta, StoryObj } from '@storybook/react';
import ProductCard from './ProductCard';
import type { ProductListItem } from '@/types/product';

const baseProduct: ProductListItem = {
  id: 1,
  code: 'PRD-001',
  name: 'Порошок для прання Universal 3кг',
  slug: 'poroshok-universal-3kg',
  priceRetail: 189,
  priceWholesale: 159,
  priceWholesale2: null,
  priceWholesale3: null,
  priceRetailOld: null,
  priceWholesaleOld: null,
  quantity: 50,
  isPromo: false,
  isActive: true,
  imagePath: '/images/placeholder-product.jpg',
  viewsCount: 120,
  ordersCount: 45,
  createdAt: '2024-01-15T00:00:00Z',
  category: { id: 1, name: 'Порошки', slug: 'poroshky' },
  badges: [],
  images: [
    { id: 1, pathFull: '/images/placeholder-product.jpg', pathMedium: '/images/placeholder-product.jpg', pathThumbnail: '/images/placeholder-thumb.jpg', pathBlur: null, isMain: true },
  ],
  content: { shortDescription: 'Універсальний порошок для всіх типів тканин' },
};

const meta: Meta<typeof ProductCard> = {
  title: 'Product/ProductCard',
  component: ProductCard,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProductCard>;

export const Default: Story = {
  args: {
    product: baseProduct,
  },
};

export const OnSale: Story = {
  args: {
    product: {
      ...baseProduct,
      id: 2,
      priceRetailOld: 249,
      isPromo: true,
      badges: [{ id: 1, badgeType: 'sale', customText: '-24%', customColor: '#ef4444', priority: 1 }],
    },
  },
};

export const OutOfStock: Story = {
  args: {
    product: {
      ...baseProduct,
      id: 3,
      quantity: 0,
    },
  },
};

export const Wholesale: Story = {
  args: {
    product: {
      ...baseProduct,
      id: 4,
      priceWholesale: 149,
      priceWholesale2: 139,
      priceWholesale3: 129,
      badges: [{ id: 2, badgeType: 'wholesale', customText: 'Опт', customColor: '#3b82f6', priority: 2 }],
    },
  },
};
