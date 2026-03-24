import type { Meta, StoryObj } from '@storybook/react';
import PerformanceWidget from './PerformanceWidget';
import { apiClient } from '@/lib/api-client';

const mockData = [
  {
    date: '2025-12-01',
    route: '/',
    metric: 'LCP',
    p50: 1800,
    p75: 2200,
    p90: 3500,
    sampleCount: 1200,
  },
  { date: '2025-12-01', route: '/', metric: 'FID', p50: 50, p75: 80, p90: 150, sampleCount: 1100 },
  {
    date: '2025-12-01',
    route: '/',
    metric: 'CLS',
    p50: 0.05,
    p75: 0.08,
    p90: 0.15,
    sampleCount: 1000,
  },
  {
    date: '2025-12-01',
    route: '/',
    metric: 'TTFB',
    p50: 400,
    p75: 600,
    p90: 1200,
    sampleCount: 1200,
  },
  { date: '2025-12-01', route: '/', metric: 'INP', p50: 120, p75: 180, p90: 350, sampleCount: 900 },
  {
    date: '2025-12-01',
    route: '/',
    metric: 'FCP',
    p50: 1200,
    p75: 1600,
    p90: 2800,
    sampleCount: 1100,
  },
];

const meta: Meta<typeof PerformanceWidget> = {
  title: 'Admin/Analytics/PerformanceWidget',
  component: PerformanceWidget,
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
type Story = StoryObj<typeof PerformanceWidget>;

export const Default: Story = {
  args: { days: 30 },
};
