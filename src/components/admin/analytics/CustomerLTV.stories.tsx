import type { Meta, StoryObj } from '@storybook/react';
import CustomerLTV from './CustomerLTV';
import { apiClient } from '@/lib/api-client';

const mockData = {
  topCustomers: [
    {
      userId: 1,
      email: 'vip@example.com',
      fullName: 'Top Buyer',
      companyName: 'CleanCo',
      totalSpent: 85000,
      orderCount: 25,
      avgCheck: 3400,
      firstOrderAt: '2024-03-01',
      lastOrderAt: '2025-12-15',
      lifetimeDays: 654,
      monthlyValue: 3900,
      projectedYearlyLTV: 46800,
    },
    {
      userId: 2,
      email: 'loyal@test.com',
      fullName: 'Regular Customer',
      companyName: null,
      totalSpent: 42000,
      orderCount: 14,
      avgCheck: 3000,
      firstOrderAt: '2024-06-10',
      lastOrderAt: '2025-11-20',
      lifetimeDays: 528,
      monthlyValue: 2400,
      projectedYearlyLTV: 28800,
    },
  ],
  summary: { totalCustomers: 340, totalRevenue: 1500000, avgLTV: 4412, medianLTV: 2800 },
  distribution: [
    { label: '0-1k', count: 120, revenue: 60000 },
    { label: '1-5k', count: 150, revenue: 450000 },
    { label: '5-10k', count: 50, revenue: 375000 },
    { label: '10k+', count: 20, revenue: 615000 },
  ],
};

const meta: Meta<typeof CustomerLTV> = {
  title: 'Admin/Analytics/CustomerLTV',
  component: CustomerLTV,
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
type Story = StoryObj<typeof CustomerLTV>;

export const Default: Story = {
  args: { days: 365 },
};
