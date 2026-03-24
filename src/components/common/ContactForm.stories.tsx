import type { Meta, StoryObj } from '@storybook/react';
import ContactForm from './ContactForm';

const meta: Meta<typeof ContactForm> = {
  title: 'Common/ContactForm',
  component: ContactForm,
};
export default meta;
type Story = StoryObj<typeof ContactForm>;

export const Default: Story = {};

export const InCard: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Зворотній зв&apos;язок</h2>
        <Story />
      </div>
    ),
  ],
};

export const NarrowLayout: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xs p-4">
        <Story />
      </div>
    ),
  ],
};
