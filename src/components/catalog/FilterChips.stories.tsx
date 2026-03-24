import type { Meta, StoryObj } from '@storybook/react';
import FilterChips from './FilterChips';

const meta: Meta<typeof FilterChips> = {
  title: 'Catalog/FilterChips',
  component: FilterChips,
};
export default meta;
type Story = StoryObj<typeof FilterChips>;

export const Default: Story = {
  args: {
    filters: [
      { key: 'category_pralni', label: 'Категорія', value: 'Пральні засоби' },
      { key: 'price_min', label: 'Ціна від', value: '100 ₴' },
      { key: 'promo', label: 'Фільтр', value: 'Акційні' },
    ],
    onRemove: () => {},
    onClearAll: () => {},
  },
};

export const SingleChip: Story = {
  args: {
    filters: [{ key: 'in_stock', label: 'Фільтр', value: 'В наявності' }],
    onRemove: () => {},
    onClearAll: () => {},
  },
};

export const Empty: Story = {
  args: {
    filters: [],
    onRemove: () => {},
    onClearAll: () => {},
  },
};
