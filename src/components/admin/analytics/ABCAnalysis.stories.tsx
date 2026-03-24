import type { Meta, StoryObj } from '@storybook/react';
import ABCAnalysis from './ABCAnalysis';
import { apiClient } from '@/lib/api-client';

const mockData = {
  products: [
    {
      productId: 1,
      productCode: 'P001',
      productName: 'Premium Powder',
      revenue: 50000,
      quantity: 200,
      orders: 80,
      revenuePercent: 40,
      cumulativePercent: 40,
      category: 'A' as const,
    },
    {
      productId: 2,
      productCode: 'P002',
      productName: 'Basic Cleaner',
      revenue: 20000,
      quantity: 150,
      orders: 60,
      revenuePercent: 16,
      cumulativePercent: 56,
      category: 'B' as const,
    },
    {
      productId: 3,
      productCode: 'P003',
      productName: 'Budget Soap',
      revenue: 5000,
      quantity: 50,
      orders: 20,
      revenuePercent: 4,
      cumulativePercent: 96,
      category: 'C' as const,
    },
  ],
  summary: { A: 5, B: 15, C: 30, totalRevenue: 125000, totalProducts: 50 },
};

const meta: Meta<typeof ABCAnalysis> = {
  title: 'Admin/Analytics/ABCAnalysis',
  component: ABCAnalysis,
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
type Story = StoryObj<typeof ABCAnalysis>;

export const Default: Story = {
  args: { days: 30 },
};
