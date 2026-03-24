import type { Meta, StoryObj } from '@storybook/react';
import MiniCart from './MiniCart';

const meta: Meta<typeof MiniCart> = {
  title: 'Layout/MiniCart',
  component: MiniCart,
  parameters: {
    nextjs: { appDirectory: true },
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 400, height: 500 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof MiniCart>;

export const Default: Story = {
  args: {
    onClose: () => console.log('MiniCart closed'),
  },
};
