import type { Meta, StoryObj } from '@storybook/react';
import BundleCard from './BundleCard';

const meta: Meta<typeof BundleCard> = {
  title: 'Bundle/BundleCard',
  component: BundleCard,
};

export default meta;
type Story = StoryObj<typeof BundleCard>;

export const WithDiscount: Story = {
  args: {
    bundle: {
      slug: 'cleaning-starter',
      name: 'Стартовий набір для прибирання',
      description: 'Все необхідне для генерального прибирання квартири.',
      imagePath: null,
      discountPercent: 15,
      isActive: true,
      _count: { items: 5 },
    },
    originalPrice: 850,
    finalPrice: 722.5,
  },
};

export const WithFixedPrice: Story = {
  args: {
    bundle: {
      slug: 'laundry-set',
      name: 'Набір для прання',
      description: 'Порошок + кондиціонер + плямовивідник',
      imagePath: '/images/banners/banner-2.png',
      discountPercent: 0,
      isActive: true,
      _count: { items: 3 },
    },
    originalPrice: 500,
    finalPrice: 399,
  },
};
