import type { Meta, StoryObj } from '@storybook/react';
import CohortAnalysis from './CohortAnalysis';
import { apiClient } from '@/lib/api-client';

const mockData = [
  {
    cohort: '2025-07',
    totalUsers: 50,
    retention: { '2025-07': 100, '2025-08': 60, '2025-09': 40, '2025-10': 30 },
  },
  {
    cohort: '2025-08',
    totalUsers: 65,
    retention: { '2025-08': 100, '2025-09': 55, '2025-10': 35 },
  },
  { cohort: '2025-09', totalUsers: 40, retention: { '2025-09': 100, '2025-10': 50 } },
];

const meta: Meta<typeof CohortAnalysis> = {
  title: 'Admin/Analytics/CohortAnalysis',
  component: CohortAnalysis,
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
type Story = StoryObj<typeof CohortAnalysis>;

export const Default: Story = {
  args: { months: 6 },
};
