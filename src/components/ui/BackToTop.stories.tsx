import type { Meta, StoryObj } from '@storybook/react';
import BackToTop from './BackToTop';

const meta: Meta<typeof BackToTop> = {
  title: 'UI/BackToTop',
  component: BackToTop,
  decorators: [
    (Story) => (
      <div style={{ height: '200vh', paddingTop: '120vh' }}>
        <p className="mb-4 text-sm text-gray-500">Scroll up to trigger the button.</p>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BackToTop>;

export const Default: Story = {};
