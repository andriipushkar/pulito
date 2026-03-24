import type { Meta, StoryObj } from '@storybook/react';
import ImageGallery from './ImageGallery';
import type { ProductImage } from '@/types/product';

const sampleImages: ProductImage[] = [
  {
    id: 1,
    pathFull: '/placeholder.png',
    pathMedium: '/placeholder.png',
    pathThumbnail: '/placeholder.png',
    isMain: true,
    altText: 'Product front',
  },
  {
    id: 2,
    pathFull: '/placeholder.png',
    pathMedium: '/placeholder.png',
    pathThumbnail: '/placeholder.png',
    isMain: false,
    altText: 'Product back',
  },
  {
    id: 3,
    pathFull: '/placeholder.png',
    pathMedium: '/placeholder.png',
    pathThumbnail: '/placeholder.png',
    isMain: false,
    altText: 'Product detail',
  },
];

const meta: Meta<typeof ImageGallery> = {
  title: 'Product/ImageGallery',
  component: ImageGallery,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof ImageGallery>;

export const MultipleImages: Story = {
  args: {
    images: sampleImages,
    productName: 'Premium Cleaning Powder',
  },
};

export const SingleImage: Story = {
  args: {
    images: [sampleImages[0]],
    productName: 'Single Image Product',
  },
};

export const NoImages: Story = {
  args: {
    images: [],
    productName: 'No Image Product',
  },
};
