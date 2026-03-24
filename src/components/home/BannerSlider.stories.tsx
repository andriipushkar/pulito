import type { Meta, StoryObj } from '@storybook/react';
import BannerSlider from './BannerSlider';

const meta: Meta<typeof BannerSlider> = {
  title: 'Home/BannerSlider',
  component: BannerSlider,
};
export default meta;
type Story = StoryObj<typeof BannerSlider>;

// BannerSlider fetches data via SWR internally; render it as-is
export const Default: Story = {};

export const InContainer: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl p-4">
        <Story />
      </div>
    ),
  ],
};

export const FullWidth: Story = {
  decorators: [
    (Story) => (
      <div className="w-full">
        <Story />
      </div>
    ),
  ],
};
