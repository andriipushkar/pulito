import type { Meta, StoryObj } from '@storybook/react';
import MobileBottomNav from './MobileBottomNav';

const meta: Meta<typeof MobileBottomNav> = {
  title: 'Layout/MobileBottomNav',
  component: MobileBottomNav,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
export default meta;
type Story = StoryObj<typeof MobileBottomNav>;

const sampleCategories = [
  {
    id: 1,
    name: 'Пральні засоби',
    slug: 'pralni-zasoby',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 1,
    isVisible: true,
    parentId: null,
    _count: { products: 42 },
  },
  {
    id: 2,
    name: 'Для посуду',
    slug: 'dlya-posudu',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 2,
    isVisible: true,
    parentId: null,
    _count: { products: 28 },
  },
];

export const Default: Story = {
  args: {
    categories: sampleCategories,
  },
};

export const EmptyCategories: Story = {
  args: {
    categories: [],
  },
};
