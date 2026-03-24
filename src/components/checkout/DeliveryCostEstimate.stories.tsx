import type { Meta, StoryObj } from '@storybook/react';
import DeliveryCostEstimate from './DeliveryCostEstimate';

/**
 * DeliveryCostEstimate fetches cost estimates from the API.
 * Without API mocks it renders nothing (the empty/loading state returns null).
 * Stories document the expected prop combinations.
 */
const meta: Meta<typeof DeliveryCostEstimate> = {
  title: 'Checkout/DeliveryCostEstimate',
  component: DeliveryCostEstimate,
};
export default meta;
type Story = StoryObj<typeof DeliveryCostEstimate>;

export const NovaPoshta: Story = {
  args: {
    deliveryMethod: 'nova_poshta',
    city: 'Київ',
    cartTotal: 1500,
  },
};

export const Ukrposhta: Story = {
  args: {
    deliveryMethod: 'ukrposhta',
    city: 'Харків',
    cartTotal: 300,
    cartWeight: 2.5,
  },
};

export const Pickup: Story = {
  args: {
    deliveryMethod: 'pickup',
    city: '',
    cartTotal: 500,
  },
};
