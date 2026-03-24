import type { Meta, StoryObj } from '@storybook/react';
import TopBar from './TopBar';

const meta: Meta<typeof TopBar> = {
  title: 'Layout/TopBar',
  component: TopBar,
};
export default meta;
type Story = StoryObj<typeof TopBar>;

export const Default: Story = {};

export const MobileViewport: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};

export const DesktopViewport: Story = {
  parameters: {
    viewport: { defaultViewport: 'responsive' },
  },
};
