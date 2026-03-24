import type { Meta, StoryObj } from '@storybook/react';
import FaqSearch from './FaqSearch';

const meta: Meta<typeof FaqSearch> = {
  title: 'FAQ/FaqSearch',
  component: FaqSearch,
};
export default meta;
type Story = StoryObj<typeof FaqSearch>;

export const Default: Story = {
  args: {
    onResults: () => {},
    onQueryChange: () => {},
  },
};

export const InCard: Story = {
  args: {
    onResults: () => {},
    onQueryChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg rounded-xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Часті питання</h2>
        <Story />
      </div>
    ),
  ],
};

export const FullWidth: Story = {
  args: {
    onResults: () => {},
    onQueryChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-full p-4">
        <Story />
      </div>
    ),
  ],
};
