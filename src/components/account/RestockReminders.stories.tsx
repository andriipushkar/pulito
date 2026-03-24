import type { Meta, StoryObj } from '@storybook/react';
import RestockReminders from './RestockReminders';

const meta: Meta<typeof RestockReminders> = {
  title: 'Account/RestockReminders',
  component: RestockReminders,
};
export default meta;
type Story = StoryObj<typeof RestockReminders>;

// RestockReminders fetches predictions via apiClient internally; render as-is
export const Default: Story = {};

export const InCard: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
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
