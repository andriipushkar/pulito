import type { Meta, StoryObj } from '@storybook/react';
import FloatingBuyBar from './FloatingBuyBar';

const meta: Meta<typeof FloatingBuyBar> = {
  title: 'Product/FloatingBuyBar',
  component: FloatingBuyBar,
  decorators: [
    (Story) => (
      <div style={{ minHeight: '200vh', paddingTop: '100vh' }}>
        <p>Scroll down to see the floating bar appear.</p>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<typeof FloatingBuyBar>;

export const Default: Story = {
  args: {
    productId: 1,
    name: 'Засіб для миття посуду 500мл',
    slug: 'zasib-dlya-mittya-posudu-500ml',
    code: 'CLN-001',
    priceRetail: 149.99,
    priceWholesale: 120.0,
    imagePath: null,
    quantity: 50,
  },
};

export const OutOfStock: Story = {
  args: {
    productId: 2,
    name: 'Рідке мило 300мл',
    slug: 'ridke-milo-300ml',
    code: 'CLN-002',
    priceRetail: 79.99,
    priceWholesale: null,
    imagePath: null,
    quantity: 0,
  },
};

export const ExpensiveProduct: Story = {
  args: {
    productId: 3,
    name: 'Професійний пароочисник Industrial Pro 3000',
    slug: 'profesijnij-paroochisnik',
    code: 'CLN-PRO-003',
    priceRetail: 12499.0,
    priceWholesale: 10999.0,
    imagePath: null,
    quantity: 5,
  },
};
