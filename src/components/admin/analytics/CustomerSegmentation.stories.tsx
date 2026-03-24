import type { Meta, StoryObj } from '@storybook/react';
import CustomerSegmentation from './CustomerSegmentation';
import { apiClient } from '@/lib/api-client';

const mockData = {
  segments: [
    {
      segment: 'champions',
      label: 'Champions',
      count: 25,
      revenue: 250000,
      avgCheck: 5000,
      customers: [
        {
          userId: 1,
          email: 'champ@test.com',
          fullName: 'Champion User',
          lastOrderDays: 3,
          orderCount: 20,
          totalSpent: 50000,
        },
      ],
    },
    { segment: 'loyal', label: 'Loyal', count: 40, revenue: 200000, avgCheck: 3500, customers: [] },
    {
      segment: 'at_risk',
      label: 'At Risk',
      count: 15,
      revenue: 45000,
      avgCheck: 2000,
      customers: [],
    },
    { segment: 'lost', label: 'Lost', count: 30, revenue: 15000, avgCheck: 1500, customers: [] },
  ],
  totalCustomers: 110,
  totalRevenue: 510000,
};

const meta: Meta<typeof CustomerSegmentation> = {
  title: 'Admin/Analytics/CustomerSegmentation',
  component: CustomerSegmentation,
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
type Story = StoryObj<typeof CustomerSegmentation>;

export const Default: Story = {};
