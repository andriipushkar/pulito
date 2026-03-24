import type { Meta, StoryObj } from '@storybook/react';
import RecentlyViewedSection from './RecentlyViewedSection';

/**
 * RecentlyViewedSection fetches data from useRecentlyViewed hook and an API endpoint.
 * In Storybook it will render nothing unless mocks are provided for both
 * the hook and the fetch call. Shown here for completeness.
 */
const meta: Meta<typeof RecentlyViewedSection> = {
  title: 'Product/RecentlyViewedSection',
  component: RecentlyViewedSection,
};
export default meta;
type Story = StoryObj<typeof RecentlyViewedSection>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'When no recently viewed IDs exist, nothing renders.',
      },
    },
  },
};
