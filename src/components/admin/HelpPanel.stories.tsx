import type { Meta, StoryObj } from '@storybook/react';
import HelpPanel from './HelpPanel';

const meta: Meta<typeof HelpPanel> = {
  title: 'Admin/HelpPanel',
  component: HelpPanel,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof HelpPanel>;

// HelpPanel has no props; it reads pathname via usePathname.
// Click the "?" button or press F1 to open.
export const Default: Story = {};
