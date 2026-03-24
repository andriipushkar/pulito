import type { Meta, StoryObj } from '@storybook/react';
import FilterSidebar from './FilterSidebar';

const meta: Meta<typeof FilterSidebar> = {
  title: 'Catalog/FilterSidebar',
  component: FilterSidebar,
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FilterSidebar>;

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
  {
    id: 3,
    name: 'Для підлоги',
    slug: 'dlya-pidlogy',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 3,
    isVisible: true,
    parentId: null,
    _count: { products: 15 },
  },
  {
    id: 10,
    name: 'Гелі',
    slug: 'geli',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 10,
    isVisible: true,
    parentId: 1,
    _count: { products: 12 },
  },
  {
    id: 11,
    name: 'Порошки',
    slug: 'poroshky',
    iconPath: null,
    coverImage: null,
    description: null,
    sortOrder: 11,
    isVisible: true,
    parentId: 1,
    _count: { products: 18 },
  },
];

const sampleBrands = [
  { slug: 'frosch', name: 'Frosch', count: 24 },
  { slug: 'fairy', name: 'Fairy', count: 18 },
  { slug: 'persil', name: 'Persil', count: 15 },
  { slug: 'tide', name: 'Tide', count: 12 },
];

export const Default: Story = {
  args: {
    categories: sampleCategories,
    brands: sampleBrands,
  },
};

export const CategoriesOnly: Story = {
  args: {
    categories: sampleCategories,
    brands: [],
  },
};

export const EmptyState: Story = {
  args: {
    categories: [],
    brands: [],
  },
};
