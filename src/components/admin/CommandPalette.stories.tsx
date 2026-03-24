import type { Meta, StoryObj } from '@storybook/react';
import CommandPalette from './CommandPalette';

const meta: Meta<typeof CommandPalette> = {
  title: 'Admin/CommandPalette',
  component: CommandPalette,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof CommandPalette>;

// CommandPalette has no props; it opens via Ctrl+K.
// We render it and instruct the user to press Ctrl+K to activate.
export const Default: Story = {
  render: () => (
    <div>
      <p style={{ padding: 20, color: '#666' }}>
        Press <kbd>Ctrl+K</kbd> (or <kbd>Cmd+K</kbd>) to open the Command Palette.
      </p>
      <CommandPalette />
    </div>
  ),
};
