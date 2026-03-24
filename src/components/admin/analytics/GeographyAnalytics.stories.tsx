import type { Meta, StoryObj } from '@storybook/react';
import GeographyAnalytics from './GeographyAnalytics';
import { apiClient } from '@/lib/api-client';

const mockData = {
  cities: [
    {
      city: 'Kyiv',
      orders: 200,
      revenue: 500000,
      ordersPercent: 40,
      revenuePercent: 45,
      avgCheck: 2500,
    },
    {
      city: 'Lviv',
      orders: 80,
      revenue: 160000,
      ordersPercent: 16,
      revenuePercent: 14,
      avgCheck: 2000,
    },
    {
      city: 'Odesa',
      orders: 60,
      revenue: 120000,
      ordersPercent: 12,
      revenuePercent: 11,
      avgCheck: 2000,
    },
  ],
  totalCities: 45,
  totalOrders: 500,
  totalRevenue: 1100000,
  topCity: {
    city: 'Kyiv',
    orders: 200,
    revenue: 500000,
    ordersPercent: 40,
    revenuePercent: 45,
    avgCheck: 2500,
  },
  byDeliveryMethod: [
    { method: 'nova_poshta', orders: 350, revenue: 770000 },
    { method: 'self_pickup', orders: 100, revenue: 220000 },
    { method: 'ukrposhta', orders: 50, revenue: 110000 },
  ],
};

const meta: Meta<typeof GeographyAnalytics> = {
  title: 'Admin/Analytics/GeographyAnalytics',
  component: GeographyAnalytics,
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
type Story = StoryObj<typeof GeographyAnalytics>;

export const Default: Story = {
  args: { days: 30 },
};
