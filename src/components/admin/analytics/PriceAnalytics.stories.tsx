import type { Meta, StoryObj } from '@storybook/react';
import PriceAnalytics from './PriceAnalytics';
import { apiClient } from '@/lib/api-client';

const mockData = {
  changes: [
    {
      productId: 1,
      product: { name: 'Premium Powder', code: 'P001' },
      priceRetailOld: 250,
      priceRetailNew: 280,
      changePercent: 12,
      changedAt: '2025-11-15',
    },
    {
      productId: 2,
      product: { name: 'Basic Cleaner', code: 'P002' },
      priceRetailOld: 180,
      priceRetailNew: 160,
      changePercent: -11.1,
      changedAt: '2025-11-10',
    },
  ],
  promoImpact: [
    {
      productId: 1,
      productName: 'Premium Powder',
      productCode: 'P001',
      avgSalesBefore: 5,
      avgSalesAfter: 12,
      salesLift: 140,
      revenueBefore: 1250,
      revenueAfter: 3360,
    },
  ],
  summary: { totalChanges: 45, priceIncreases: 25, priceDecreases: 20, avgChangePercent: 8.5 },
};

const meta: Meta<typeof PriceAnalytics> = {
  title: 'Admin/Analytics/PriceAnalytics',
  component: PriceAnalytics,
  decorators: [
    (Story) => {
      const originalGet = apiClient.get;
      apiClient.get = () => Promise.resolve({ success: true, data: mockData } as never);
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
type Story = StoryObj<typeof PriceAnalytics>;

export const Default: Story = {
  args: { days: 30 },
};
