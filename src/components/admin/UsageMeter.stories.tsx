import type { Meta, StoryObj } from '@storybook/react';
import UsageMeter from './UsageMeter';

const meta: Meta<typeof UsageMeter> = {
  title: 'Admin/UsageMeter',
  component: UsageMeter,
  args: {
    label: 'API Requests',
    used: 750,
    max: 1000,
  },
};
export default meta;
type Story = StoryObj<typeof UsageMeter>;

export const Normal: Story = {
  args: { label: 'Storage', used: 30, max: 100 },
};

export const Warning: Story = {
  args: { label: 'API Calls', used: 750, max: 1000 },
};

export const Critical: Story = {
  args: { label: 'Bandwidth', used: 950, max: 1000 },
};
