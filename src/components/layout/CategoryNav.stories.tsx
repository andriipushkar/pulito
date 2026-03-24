import type { Meta, StoryObj } from '@storybook/react';
import CategoryNav from './CategoryNav';
import type { CategoryListItem } from '@/types/category';

const mockCategories: CategoryListItem[] = [
  {
    id: 1,
    name: 'Cleaning Products',
    slug: 'cleaning',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 1,
    isVisible: true,
    parentId: null,
    _count: { products: 150 },
  },
  {
    id: 2,
    name: 'Powder',
    slug: 'powder',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 1,
    isVisible: true,
    parentId: 1,
    _count: { products: 45 },
  },
  {
    id: 3,
    name: 'Liquid',
    slug: 'liquid',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 2,
    isVisible: true,
    parentId: 1,
    _count: { products: 60 },
  },
  {
    id: 4,
    name: 'Accessories',
    slug: 'accessories',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 2,
    isVisible: true,
    parentId: null,
    _count: { products: 80 },
  },
  {
    id: 5,
    name: 'Wholesale Packs',
    slug: 'wholesale',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 3,
    isVisible: true,
    parentId: null,
    _count: { products: 30 },
  },
];

const meta: Meta<typeof CategoryNav> = {
  title: 'Layout/CategoryNav',
  component: CategoryNav,
  parameters: {
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof CategoryNav>;

export const Default: Story = {
  args: { categories: mockCategories },
};

export const Shrunk: Story = {
  args: { categories: mockCategories, shrink: true },
};
