import type { Meta, StoryObj } from '@storybook/react';
import QuickView from './QuickView';
import { apiClient } from '@/lib/api-client';

const mockProduct = {
  id: 1,
  code: 'P001',
  name: 'Premium Cleaning Powder 5kg',
  slug: 'premium-cleaning-powder-5kg',
  priceRetail: 450,
  priceWholesale: 380,
  priceWholesale2: null,
  priceWholesale3: null,
  priceRetailOld: 520,
  priceWholesaleOld: null,
  quantity: 25,
  isPromo: true,
  isActive: true,
  imagePath: '/placeholder.png',
  viewsCount: 100,
  ordersCount: 30,
  createdAt: '2025-01-01',
  category: { id: 1, name: 'Cleaning', slug: 'cleaning' },
  badges: [],
  images: [
    {
      id: 1,
      pathFull: '/placeholder.png',
      pathMedium: '/placeholder.png',
      pathThumbnail: '/placeholder.png',
      isMain: true,
    },
  ],
  content: { shortDescription: 'High quality cleaning powder' },
};

const meta: Meta<typeof QuickView> = {
  title: 'Product/QuickView',
  component: QuickView,
  parameters: {
    nextjs: { appDirectory: true },
  },
  decorators: [
    (Story) => {
      const originalGet = apiClient.get;
      apiClient.get = () => Promise.resolve({ success: true, data: mockProduct } as never);
      const cleanup = () => {
        apiClient.get = originalGet;
      };
      return (
        <>
          {<Story />}
          {void setTimeout(cleanup, 0) as unknown as null}
        </>
      );
    },
  ],
};
export default meta;
type Story = StoryObj<typeof QuickView>;

export const Default: Story = {
  args: {
    productId: 1,
    onClose: () => console.log('QuickView closed'),
  },
};
