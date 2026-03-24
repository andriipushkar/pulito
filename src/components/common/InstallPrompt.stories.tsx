import type { Meta, StoryObj } from '@storybook/react';
import InstallPrompt from './InstallPrompt';

const meta: Meta<typeof InstallPrompt> = {
  title: 'Common/InstallPrompt',
  component: InstallPrompt,
};
export default meta;
type Story = StoryObj<typeof InstallPrompt>;

// InstallPrompt relies on beforeinstallprompt browser event and returns null
// when not visible, so we render it as-is for documentation purposes.
export const Default: Story = {};

export const MobileViewport: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
