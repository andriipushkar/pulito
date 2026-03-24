import type { Meta, StoryObj } from '@storybook/react';
import HeaderMain from './HeaderMain';

const meta: Meta<typeof HeaderMain> = {
  title: 'Layout/HeaderMain',
  component: HeaderMain,
};
export default meta;
type Story = StoryObj<typeof HeaderMain>;

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
    shrink: false,
  },
};

export const Shrunk: Story = {
  args: {
    categories: sampleCategories,
    shrink: true,
  },
};
