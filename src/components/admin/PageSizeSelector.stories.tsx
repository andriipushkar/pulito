import type { Meta, StoryObj } from '@storybook/react';
import PageSizeSelector from './PageSizeSelector';

const meta: Meta<typeof PageSizeSelector> = {
  title: 'Admin/PageSizeSelector',
  component: PageSizeSelector,
  args: {
    value: 20,
    onChange: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof PageSizeSelector>;

export const Default: Story = {};

export const LargePageSize: Story = {
  args: { value: 100 },
};
