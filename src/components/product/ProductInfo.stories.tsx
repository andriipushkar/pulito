import type { Meta, StoryObj } from '@storybook/react';
import ProductInfo from './ProductInfo';
import type { ProductDetail } from '@/types/product';

const mockProduct: ProductDetail = {
  id: 1,
  code: 'P001',
  name: 'Premium Cleaning Powder 5kg',
  slug: 'premium-cleaning-powder-5kg',
  priceRetail: 450,
  priceWholesale: 380,
  priceWholesale2: 360,
  priceWholesale3: 340,
  priceRetailOld: 520,
  priceWholesaleOld: null,
  quantity: 25,
  isPromo: true,
  isActive: true,
  imagePath: '/placeholder.png',
  viewsCount: 500,
  ordersCount: 80,
  sortOrder: 0,
  promoStartDate: null,
  promoEndDate: null,
  createdAt: '2025-01-01',
  updatedAt: '2025-11-01',
  category: { id: 1, name: 'Cleaning', slug: 'cleaning', seoTitle: null, seoDescription: null },
  badges: [{ id: 1, badgeType: 'promo', customText: 'Sale', customColor: '#ef4444', priority: 1 }],
  images: [
    {
      id: 1,
      pathOriginal: '/placeholder.png',
      pathFull: '/placeholder.png',
      pathMedium: '/placeholder.png',
      pathThumbnail: '/placeholder.png',
      pathBlur: null,
      isMain: true,
      altText: 'Product',
    },
  ],
  content: {
    shortDescription: 'Professional cleaning powder for all surfaces.',
    fullDescription: '<p>Full description here.</p>',
    specifications: null,
    usageInstructions: null,
    videoUrl: null,
    seoTitle: null,
    seoDescription: null,
    isFilled: true,
  },
};

const meta: Meta<typeof ProductInfo> = {
  title: 'Product/ProductInfo',
  component: ProductInfo,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof ProductInfo>;

export const InStock: Story = {
  args: { product: mockProduct },
};

export const OutOfStock: Story = {
  args: {
    product: { ...mockProduct, quantity: 0 },
  },
};
