import type { Meta, StoryObj } from '@storybook/react';
import ReviewImageUpload from './ReviewImageUpload';

const meta: Meta<typeof ReviewImageUpload> = {
  title: 'Product/ReviewImageUpload',
  component: ReviewImageUpload,
  args: {
    onChange: (urls: string[]) => console.log('Uploaded URLs:', urls),
  },
};
export default meta;
type Story = StoryObj<typeof ReviewImageUpload>;

export const Default: Story = {};

export const LimitedTo3: Story = {
  args: {
    maxImages: 3,
  },
};
