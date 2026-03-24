import type { Meta, StoryObj } from '@storybook/react';
import QuantitySelector from './QuantitySelector';

const meta: Meta<typeof QuantitySelector> = {
  title: 'Product/QuantitySelector',
  component: QuantitySelector,
};
export default meta;
type Story = StoryObj<typeof QuantitySelector>;

export const Default: Story = {
  args: {
    value: 1,
    onChange: (v: number) => console.log('onChange', v),
    min: 1,
    max: 999,
  },
};

export const AtMinimum: Story = {
  args: {
    value: 1,
    onChange: (v: number) => console.log('onChange', v),
    min: 1,
    max: 10,
  },
};

export const AtMaximum: Story = {
  args: {
    value: 10,
    onChange: (v: number) => console.log('onChange', v),
    min: 1,
    max: 10,
  },
};
