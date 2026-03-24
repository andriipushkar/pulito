import type { Meta, StoryObj } from '@storybook/react';
import UploadProgress from './UploadProgress';

const meta: Meta<typeof UploadProgress> = {
  title: 'UI/UploadProgress',
  component: UploadProgress,
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    isUploading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof UploadProgress>;

export const Default: Story = {
  args: {
    progress: 45,
    isUploading: true,
  },
};

export const AlmostDone: Story = {
  args: {
    progress: 92,
    isUploading: true,
  },
};

export const NotUploading: Story = {
  args: {
    progress: 0,
    isUploading: false,
  },
};
