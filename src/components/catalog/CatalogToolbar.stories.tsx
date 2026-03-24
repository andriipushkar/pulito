import type { Meta, StoryObj } from '@storybook/react';
import CatalogToolbar from './CatalogToolbar';

const meta: Meta<typeof CatalogToolbar> = {
  title: 'Catalog/CatalogToolbar',
  component: CatalogToolbar,
};
export default meta;
type Story = StoryObj<typeof CatalogToolbar>;

export const Default: Story = {
  args: {
    total: 156,
    onOpenFilters: () => {},
  },
};

export const FewResults: Story = {
  args: {
    total: 3,
    onOpenFilters: () => {},
  },
};

export const NoResults: Story = {
  args: {
    total: 0,
    onOpenFilters: () => {},
  },
};
