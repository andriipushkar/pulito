import type { Meta, StoryObj } from '@storybook/react';
import ComparisonTable from './ComparisonTable';

const meta: Meta<typeof ComparisonTable> = {
  title: 'Product/ComparisonTable',
  component: ComparisonTable,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof ComparisonTable>;

// ComparisonTable reads IDs from useComparison hook and fetches via API.
// In Storybook, it will render the empty state by default.
export const EmptyComparison: Story = {};
