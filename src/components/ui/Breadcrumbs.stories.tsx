import type { Meta, StoryObj } from '@storybook/react';
import Breadcrumbs from './Breadcrumbs';

const meta: Meta<typeof Breadcrumbs> = {
  title: 'UI/Breadcrumbs',
  component: Breadcrumbs,
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

export const Default: Story = {
  args: {
    items: [
      { label: 'Головна', href: '/' },
      { label: 'Каталог', href: '/catalog' },
      { label: 'Засоби для прибирання' },
    ],
  },
};

export const ManyItems: Story = {
  args: {
    items: [
      { label: 'Головна', href: '/' },
      { label: 'Каталог', href: '/catalog' },
      { label: 'Засоби для кухні', href: '/catalog/kitchen' },
      { label: 'Миючі засоби', href: '/catalog/kitchen/detergents' },
      { label: 'Fairy Original' },
    ],
  },
};

export const TwoItems: Story = {
  args: {
    items: [{ label: 'Головна', href: '/' }, { label: 'Контакти' }],
  },
};
