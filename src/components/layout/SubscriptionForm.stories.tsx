import type { Meta, StoryObj } from '@storybook/react';
import SubscriptionForm from './SubscriptionForm';

const meta: Meta<typeof SubscriptionForm> = {
  title: 'Layout/SubscriptionForm',
  component: SubscriptionForm,
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-slate-800 p-6">
        <p className="mb-3 text-sm text-white">Підпишіться на новини</p>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof SubscriptionForm>;

export const Default: Story = {};

export const InFooterContext: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-lg bg-gradient-to-r from-blue-900 to-blue-800 p-6">
        <h3 className="mb-2 text-lg font-bold text-white">Будьте в курсі</h3>
        <p className="mb-4 text-sm text-blue-200">Отримуйте знижки та новинки першими</p>
        <Story />
      </div>
    ),
  ],
};
