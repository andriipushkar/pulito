import type { Meta, StoryObj } from '@storybook/react';
import ShareButtons from './ShareButtons';

const meta: Meta<typeof ShareButtons> = {
  title: 'Product/ShareButtons',
  component: ShareButtons,
};
export default meta;
type Story = StoryObj<typeof ShareButtons>;

export const Default: Story = {
  args: {
    url: '/product/cleaning-gel-500ml',
    title: 'Гель для прибирання 500мл',
  },
};

export const LongTitle: Story = {
  args: {
    url: '/product/professional-cleaning-set-with-accessories',
    title: 'Професійний набір для прибирання з аксесуарами та додатковими засобами',
  },
};
