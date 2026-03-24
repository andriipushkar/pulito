import type { Meta, StoryObj } from '@storybook/react';
import LanguageSwitcher from './LanguageSwitcher';

const meta: Meta<typeof LanguageSwitcher> = {
  title: 'Layout/LanguageSwitcher',
  component: LanguageSwitcher,
};
export default meta;
type Story = StoryObj<typeof LanguageSwitcher>;

export const Default: Story = {};

export const InHeader: Story = {
  decorators: [
    (Story) => (
      <div className="flex items-center gap-4 border-b border-gray-200 px-4 py-2 text-sm">
        <span>+38 (000) 123-45-67</span>
        <Story />
      </div>
    ),
  ],
};
