import type { Meta, StoryObj } from '@storybook/react';
import BrandLogos from './BrandLogos';

const meta: Meta<typeof BrandLogos> = {
  title: 'Home/BrandLogos',
  component: BrandLogos,
};
export default meta;
type Story = StoryObj<typeof BrandLogos>;

// BrandLogos uses hardcoded brands internally, no props needed
export const Default: Story = {};

export const InSection: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl p-6">
        <Story />
      </div>
    ),
  ],
};

export const NarrowContainer: Story = {
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-sm p-4">
        <Story />
      </div>
    ),
  ],
};
