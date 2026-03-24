import type { Meta, StoryObj } from '@storybook/react';
import CallbackButton from './CallbackButton';

const meta: Meta<typeof CallbackButton> = {
  title: 'Common/CallbackButton',
  component: CallbackButton,
};
export default meta;
type Story = StoryObj<typeof CallbackButton>;

export const Default: Story = {
  args: {},
};

export const CustomTrigger: Story = {
  args: {
    triggerClassName:
      'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700',
    iconSize: 18,
  },
};

export const SmallIcon: Story = {
  args: {
    triggerClassName:
      'inline-flex items-center justify-center rounded-full bg-gray-100 h-8 w-8 text-gray-600 hover:bg-gray-200',
    iconSize: 14,
  },
};
