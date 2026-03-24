import type { Meta, StoryObj } from '@storybook/react';
import BoughtTogetherSection from './BoughtTogetherSection';
import { apiClient } from '@/lib/api-client';

const mockProducts = [
  {
    id: 10,
    name: 'Dish Soap 500ml',
    slug: 'dish-soap',
    code: 'DS01',
    priceRetail: 85,
    imagePath: '/placeholder.png',
    images: [{ pathThumbnail: '/placeholder.png' }],
  },
  {
    id: 11,
    name: 'Sponge Pack',
    slug: 'sponge-pack',
    code: 'SP01',
    priceRetail: 45,
    imagePath: '/placeholder.png',
    images: [{ pathThumbnail: '/placeholder.png' }],
  },
  {
    id: 12,
    name: 'Glass Cleaner 750ml',
    slug: 'glass-cleaner',
    code: 'GC01',
    priceRetail: 120,
    imagePath: null,
    images: [],
  },
];

const meta: Meta<typeof BoughtTogetherSection> = {
  title: 'Product/BoughtTogetherSection',
  component: BoughtTogetherSection,
  parameters: {
    nextjs: { appDirectory: true },
  },
  decorators: [
    (Story) => {
      const originalGet = apiClient.get;
      apiClient.get = () => Promise.resolve({ success: true, data: mockProducts } as never);
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
type Story = StoryObj<typeof BoughtTogetherSection>;

export const Default: Story = {
  args: { productId: 1 },
};
