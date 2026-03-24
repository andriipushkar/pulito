import type { Meta, StoryObj } from '@storybook/react';
import RFMAnalysis from './RFMAnalysis';
import { apiClient } from '@/lib/api-client';

const mockData = {
  segments: [
    {
      segment: 'champions',
      label: 'Champions',
      count: 20,
      avgRecency: 5,
      avgFrequency: 8.2,
      avgMonetary: 15000,
      color: '#22c55e',
    },
    {
      segment: 'loyal',
      label: 'Loyal',
      count: 35,
      avgRecency: 15,
      avgFrequency: 4.5,
      avgMonetary: 8000,
      color: '#3b82f6',
    },
    {
      segment: 'needs_attention',
      label: 'Needs Attention',
      count: 18,
      avgRecency: 45,
      avgFrequency: 2.1,
      avgMonetary: 3500,
      color: '#f97316',
    },
    {
      segment: 'at_risk',
      label: 'At Risk',
      count: 12,
      avgRecency: 90,
      avgFrequency: 1.5,
      avgMonetary: 2500,
      color: '#dc2626',
    },
    {
      segment: 'lost',
      label: 'Lost',
      count: 25,
      avgRecency: 180,
      avgFrequency: 1.0,
      avgMonetary: 1200,
      color: '#374151',
    },
  ],
  totalCustomers: 110,
};

const meta: Meta<typeof RFMAnalysis> = {
  title: 'Admin/Analytics/RFMAnalysis',
  component: RFMAnalysis,
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
type Story = StoryObj<typeof RFMAnalysis>;

export const Default: Story = {
  args: { days: 90 },
};
