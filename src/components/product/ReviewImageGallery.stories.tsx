import type { Meta, StoryObj } from '@storybook/react';
import ReviewImageGallery from './ReviewImageGallery';

const meta: Meta<typeof ReviewImageGallery> = {
  title: 'Product/ReviewImageGallery',
  component: ReviewImageGallery,
};
export default meta;
type Story = StoryObj<typeof ReviewImageGallery>;

export const MultipleImages: Story = {
  args: {
    images: ['/placeholder.png', '/placeholder.png', '/placeholder.png'],
  },
};

export const SingleImage: Story = {
  args: {
    images: ['/placeholder.png'],
  },
};
