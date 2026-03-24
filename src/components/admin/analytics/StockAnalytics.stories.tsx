import type { Meta, StoryObj } from '@storybook/react';
import StockAnalytics from './StockAnalytics';
import { apiClient } from '@/lib/api-client';

const mockData = {
  criticalStock: [
    {
      id: 1,
      code: 'P001',
      name: 'Premium Powder 5kg',
      quantity: 3,
      avgDailySales: 2,
      daysUntilOut: 1,
    },
    {
      id: 2,
      code: 'P002',
      name: 'Basic Cleaner 1L',
      quantity: 10,
      avgDailySales: 1.5,
      daysUntilOut: 6,
    },
  ],
  deadStock: [
    {
      id: 3,
      code: 'P003',
      name: 'Old Product',
      quantity: 50,
      lastSoldAt: '2025-06-01',
      daysSinceLastSale: 180,
    },
  ],
  turnoverRates: [
    {
      id: 1,
      code: 'P001',
      name: 'Premium Powder 5kg',
      quantity: 3,
      soldLast30: 60,
      turnoverRate: 2.0,
    },
    { id: 4, code: 'P004', name: 'Medium Gel', quantity: 100, soldLast30: 10, turnoverRate: 0.1 },
  ],
  summary: { totalProducts: 200, criticalCount: 8, deadStockCount: 15, avgTurnover: 0.8 },
};

const meta: Meta<typeof StockAnalytics> = {
  title: 'Admin/Analytics/StockAnalytics',
  component: StockAnalytics,
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
type Story = StoryObj<typeof StockAnalytics>;

export const Default: Story = {
  args: { days: 30 },
};
