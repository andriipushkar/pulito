import type { Meta, StoryObj } from '@storybook/react';
import LoyaltyDashboard from './LoyaltyDashboard';

const meta: Meta<typeof LoyaltyDashboard> = {
  title: 'Account/LoyaltyDashboard',
  component: LoyaltyDashboard,
};
export default meta;
type Story = StoryObj<typeof LoyaltyDashboard>;

// LoyaltyDashboard fetches data via SWR internally; render as-is for documentation
export const Default: Story = {};

export const InCard: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Програма лояльності</h2>
        <Story />
      </div>
    ),
  ],
};

export const NarrowLayout: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
};
