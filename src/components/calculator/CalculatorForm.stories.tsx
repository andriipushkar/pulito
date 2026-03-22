import type { Meta, StoryObj } from '@storybook/react';
import CalculatorForm from './CalculatorForm';

const meta: Meta<typeof CalculatorForm> = {
  title: 'Calculator/CalculatorForm',
  component: CalculatorForm,
};

export default meta;
type Story = StoryObj<typeof CalculatorForm>;

export const Default: Story = {
  args: {
    onCalculate: (data) => console.log('Calculate:', data),
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    onCalculate: () => {},
    isLoading: true,
  },
};
