import type { Meta, StoryObj } from '@storybook/react';
import ProductCarousel from './ProductCarousel';
import type { ProductListItem } from '@/types/product';

const makeMockProduct = (id: number): ProductListItem => ({
  id,
  code: `PRD-${id}`,
  name: `Засіб для прибирання #${id}`,
  slug: `zasib-${id}`,
  priceRetail: 99.99 + id * 10,
  priceWholesale: null,
  priceWholesale2: null,
  priceWholesale3: null,
  priceRetailOld: id % 2 === 0 ? 149.99 + id * 10 : null,
  priceWholesaleOld: null,
  quantity: 100,
  isPromo: id % 3 === 0,
  isActive: true,
  imagePath: null,
  viewsCount: id * 50,
  ordersCount: id * 5,
  createdAt: '2025-01-01',
  category: { id: 1, name: 'Побутова хімія', slug: 'pobutova-himiya' },
  badges: [],
  images: [],
  content: { shortDescription: 'Ефективний засіб для щоденного прибирання.' },
});

const meta: Meta<typeof ProductCarousel> = {
  title: 'Product/ProductCarousel',
  component: ProductCarousel,
};
export default meta;
type Story = StoryObj<typeof ProductCarousel>;

export const Default: Story = {
  args: {
    title: 'Популярні товари',
    products: Array.from({ length: 8 }, (_, i) => makeMockProduct(i + 1)),
  },
};

export const WithViewAll: Story = {
  args: {
    title: 'Новинки',
    products: Array.from({ length: 6 }, (_, i) => makeMockProduct(i + 1)),
    viewAllHref: '/catalog?sort=newest',
  },
};

export const FewProducts: Story = {
  args: {
    title: 'Рекомендовані',
    products: [makeMockProduct(1), makeMockProduct(2)],
  },
};
