import type { Meta, StoryObj } from '@storybook/react';
import MegaMenuPanel from './MegaMenuPanel';
import type { CategoryWithChildren } from '@/types/category';

const mockCategory: CategoryWithChildren = {
  id: 1,
  name: 'Cleaning Products',
  slug: 'cleaning',
  iconPath: null,
  coverImage: null,
  description: 'All cleaning products',
  sortOrder: 1,
  isVisible: true,
  parentId: null,
  _count: { products: 150 },
  children: [
    {
      id: 2,
      name: 'Powder Cleaners',
      slug: 'powder-cleaners',
      iconPath: null,
      coverImage: null,
      description: null,
      sortOrder: 1,
      isVisible: true,
      parentId: 1,
      _count: { products: 45 },
      children: [
        {
          id: 5,
          name: 'For Kitchen',
          slug: 'kitchen-powder',
          iconPath: null,
          coverImage: null,
          description: null,
          sortOrder: 1,
          isVisible: true,
          parentId: 2,
          _count: { products: 20 },
          children: [],
        },
        {
          id: 6,
          name: 'For Bathroom',
          slug: 'bathroom-powder',
          iconPath: null,
          coverImage: null,
          description: null,
          sortOrder: 2,
          isVisible: true,
          parentId: 2,
          _count: { products: 15 },
          children: [],
        },
      ],
    },
    {
      id: 3,
      name: 'Liquid Cleaners',
      slug: 'liquid-cleaners',
      iconPath: null,
      coverImage: null,
      description: null,
      sortOrder: 2,
      isVisible: true,
      parentId: 1,
      _count: { products: 60 },
      children: [],
    },
    {
      id: 4,
      name: 'Accessories',
      slug: 'accessories',
      iconPath: null,
      coverImage: null,
      description: null,
      sortOrder: 3,
      isVisible: true,
      parentId: 1,
      _count: { products: 25 },
      children: [],
    },
  ],
};

const meta: Meta<typeof MegaMenuPanel> = {
  title: 'Layout/MegaMenuPanel',
  component: MegaMenuPanel,
  parameters: {
    nextjs: { appDirectory: true },
    viewport: { defaultViewport: 'responsive' },
  },
};
export default meta;
type Story = StoryObj<typeof MegaMenuPanel>;

export const Default: Story = {
  args: {
    category: mockCategory,
    onClose: () => console.log('Menu closed'),
  },
};
