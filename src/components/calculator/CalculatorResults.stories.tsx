import type { Meta, StoryObj } from '@storybook/react';
import CalculatorResults from './CalculatorResults';

const meta: Meta<typeof CalculatorResults> = {
  title: 'Calculator/CalculatorResults',
  component: CalculatorResults,
};

export default meta;
type Story = StoryObj<typeof CalculatorResults>;

export const WithResults: Story = {
  args: {
    recommendations: [
      {
        productId: 1,
        name: 'Fairy Platinum Plus 1L',
        slug: 'fairy-platinum-plus-1l',
        imagePath: null,
        priceRetail: 189.99,
        quantityPerMonth: 2,
        totalCost: 379.98,
        category: 'Засоби для посуду',
      },
      {
        productId: 2,
        name: 'Persil Power Gel 2L',
        slug: 'persil-power-gel-2l',
        imagePath: null,
        priceRetail: 299.5,
        quantityPerMonth: 1,
        totalCost: 299.5,
        category: 'Засоби для прання',
      },
      {
        productId: 3,
        name: 'Domestos Universal 1L',
        slug: 'domestos-universal-1l',
        imagePath: null,
        priceRetail: 99.9,
        quantityPerMonth: 3,
        totalCost: 299.7,
        category: 'Засоби для чистки',
      },
    ],
    totalMonthly: 979.18,
    totalQuarterly: 2937.54,
    onAddToCart: (productId, quantity) =>
      console.log(`Add to cart: productId=${productId}, quantity=${quantity}`),
  },
};

export const EmptyResults: Story = {
  args: {
    recommendations: [],
    totalMonthly: 0,
    totalQuarterly: 0,
    onAddToCart: () => {},
  },
};

export const SingleResult: Story = {
  args: {
    recommendations: [
      {
        productId: 1,
        name: 'Fairy Platinum Plus 1L',
        slug: 'fairy-platinum-plus-1l',
        imagePath: null,
        priceRetail: 189.99,
        quantityPerMonth: 4,
        totalCost: 759.96,
        category: 'Засоби для посуду',
      },
    ],
    totalMonthly: 759.96,
    totalQuarterly: 2279.88,
    onAddToCart: (productId, quantity) =>
      console.log(`Add to cart: productId=${productId}, quantity=${quantity}`),
  },
};
