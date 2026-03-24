import type { Meta, StoryObj } from '@storybook/react';
import PalletDeliveryForm from './PalletDeliveryForm';

const meta: Meta<typeof PalletDeliveryForm> = {
  title: 'Checkout/PalletDeliveryForm',
  component: PalletDeliveryForm,
};
export default meta;
type Story = StoryObj<typeof PalletDeliveryForm>;

export const Default: Story = {
  args: {
    onChange: (field: string, value: string) => console.log(field, value),
    errors: {},
  },
};

export const WithErrors: Story = {
  args: {
    onChange: (field: string, value: string) => console.log(field, value),
    errors: {
      palletWeightKg: 'Weight is required',
      deliveryAddress: 'Address is required',
      deliveryCity: 'City is required',
    },
  },
};
