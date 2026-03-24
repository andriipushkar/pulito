import type { Meta, StoryObj } from '@storybook/react';
import MobileMenu from './MobileMenu';

const meta: Meta<typeof MobileMenu> = {
  title: 'Layout/MobileMenu',
  component: MobileMenu,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
export default meta;
type Story = StoryObj<typeof MobileMenu>;

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
];

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    categories: sampleCategories,
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
    categories: sampleCategories,
  },
};

export const ManyCategories: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    categories: [
      ...sampleCategories,
      {
        id: 4,
        name: 'Побутова хімія',
        slug: 'pobutova-himiya',
        iconPath: null,
        coverImage: null,
        description: null,
        sortOrder: 4,
        isVisible: true,
        parentId: null,
        _count: { products: 55 },
      },
      {
        id: 5,
        name: 'Засоби гігієни',
        slug: 'zasoby-gigiyeny',
        iconPath: null,
        coverImage: null,
        description: null,
        sortOrder: 5,
        isVisible: true,
        parentId: null,
        _count: { products: 33 },
      },
      {
        id: 6,
        name: 'Для ванної',
        slug: 'dlya-vannoyi',
        iconPath: null,
        coverImage: null,
        description: null,
        sortOrder: 6,
        isVisible: true,
        parentId: null,
        _count: { products: 20 },
      },
    ],
  },
};
