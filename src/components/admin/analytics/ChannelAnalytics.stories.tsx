import type { Meta, StoryObj } from '@storybook/react';
import ChannelAnalytics from './ChannelAnalytics';
import { apiClient } from '@/lib/api-client';

const mockData = {
  bySource: [
    { source: 'web', orders: 120, revenue: 180000 },
    { source: 'telegram_bot', orders: 45, revenue: 67500 },
    { source: 'viber_bot', orders: 15, revenue: 22500 },
  ],
  byUtmSource: [
    { utmSource: 'google', utmMedium: null, utmCampaign: null, orders: 80, revenue: 120000 },
  ],
  byUtmMedium: [
    { utmSource: null, utmMedium: 'cpc', utmCampaign: null, orders: 60, revenue: 90000 },
  ],
  byUtmCampaign: [
    { utmSource: null, utmMedium: null, utmCampaign: 'spring_sale', orders: 30, revenue: 45000 },
  ],
  channelConversionRates: [
    { source: 'web', visits: 5000, conversions: 120, conversionRate: 2.4 },
    { source: 'telegram_bot', visits: 1000, conversions: 45, conversionRate: 4.5 },
  ],
};

const meta: Meta<typeof ChannelAnalytics> = {
  title: 'Admin/Analytics/ChannelAnalytics',
  component: ChannelAnalytics,
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
type Story = StoryObj<typeof ChannelAnalytics>;

export const Default: Story = {
  args: { days: 30 },
};
