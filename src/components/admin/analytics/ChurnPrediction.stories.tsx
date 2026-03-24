import type { Meta, StoryObj } from '@storybook/react';
import ChurnPrediction from './ChurnPrediction';
import { apiClient } from '@/lib/api-client';

const mockData = {
  atRiskCustomers: [
    {
      id: 1,
      email: 'user@example.com',
      fullName: 'John Doe',
      lastOrderDate: '2025-11-01',
      daysSinceLastOrder: 120,
      totalOrders: 5,
      totalSpent: 12000,
      churnProbability: 85,
    },
    {
      id: 2,
      email: 'jane@test.com',
      fullName: 'Jane Smith',
      lastOrderDate: '2025-12-15',
      daysSinceLastOrder: 75,
      totalOrders: 3,
      totalSpent: 8500,
      churnProbability: 60,
    },
  ],
  churnRate: 15.2,
  avgDaysBetweenOrders: 28,
  retentionRate: 84.8,
  churnByMonth: [
    { month: '2025-09', churned: 5, retained: 45, rate: 10 },
    { month: '2025-10', churned: 8, retained: 42, rate: 16 },
    { month: '2025-11', churned: 6, retained: 44, rate: 12 },
  ],
};

const meta: Meta<typeof ChurnPrediction> = {
  title: 'Admin/Analytics/ChurnPrediction',
  component: ChurnPrediction,
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
type Story = StoryObj<typeof ChurnPrediction>;

export const Default: Story = {
  args: { days: 90 },
};
