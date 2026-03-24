import type { Meta, StoryObj } from '@storybook/react';
import PriceHistoryChart from './PriceHistoryChart';

const mockData = [
  { id: 1, priceRetailNew: '250.00', priceWholesaleNew: '210.00', changedAt: '2025-06-01' },
  { id: 2, priceRetailNew: '280.00', priceWholesaleNew: '230.00', changedAt: '2025-07-15' },
  { id: 3, priceRetailNew: '260.00', priceWholesaleNew: '220.00', changedAt: '2025-09-01' },
  { id: 4, priceRetailNew: '300.00', priceWholesaleNew: '250.00', changedAt: '2025-11-01' },
];

const meta: Meta<typeof PriceHistoryChart> = {
  title: 'Product/PriceHistoryChart',
  component: PriceHistoryChart,
  parameters: {
    mockData: true,
  },
  decorators: [
    (Story) => {
      const originalFetch = window.fetch;
      window.fetch = (() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockData }),
        })) as typeof fetch;
      const cleanup = () => {
        window.fetch = originalFetch;
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
type Story = StoryObj<typeof PriceHistoryChart>;

export const Default: Story = {
  args: { productSlug: 'premium-powder' },
};
