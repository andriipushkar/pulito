import type { Meta, StoryObj } from '@storybook/react';
import ProductTabs from './ProductTabs';
import type { ProductContent } from '@/types/product';

const meta: Meta<typeof ProductTabs> = {
  title: 'Product/ProductTabs',
  component: ProductTabs,
};
export default meta;
type Story = StoryObj<typeof ProductTabs>;

const fullContent: ProductContent = {
  shortDescription: 'Ефективний засіб для прибирання.',
  fullDescription:
    '<h3>Опис товару</h3><p>Ефективний та безпечний засіб для щоденного прибирання. Видаляє жир, бруд та накип без зайвих зусиль.</p><ul><li>Екологічно безпечний</li><li>Приємний аромат</li><li>Економічна витрата</li></ul>',
  specifications:
    "<table><tr><th>Об'єм</th><td>500 мл</td></tr><tr><th>Країна</th><td>Україна</td></tr><tr><th>Склад</th><td>ПАР, ароматизатор, вода</td></tr></table>",
  usageInstructions: null,
  videoUrl: null,
  seoTitle: null,
  seoDescription: null,
  isFilled: true,
};

export const AllTabs: Story = {
  args: {
    content: fullContent,
  },
};

export const DescriptionOnly: Story = {
  args: {
    content: {
      ...fullContent,
      specifications: null,
    },
  },
};

export const NoContent: Story = {
  args: {
    content: null,
  },
};
