import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';
import StepDelivery from './StepDelivery';

const messages = {
  checkout: {
    stepDelivery: 'Доставка',
    novaPoshtaDesc: 'Доставка 1-3 робочі дні',
    ukrposhtaDesc: 'Доставка 3-7 робочих днів',
    pickupDesc: 'Самовивіз зі складу м. Київ',
    palletDesc: 'Палетна доставка для великих замовлень',
    deliveryCity: 'Місто',
    deliveryAddress: 'Адреса доставки',
  },
};

const meta: Meta<typeof StepDelivery> = {
  title: 'Checkout/StepDelivery',
  component: StepDelivery,
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="uk" messages={messages}>
        <div className="max-w-lg">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof StepDelivery>;

export const NoSelection: Story = {
  args: {
    data: {},
    errors: {},
    onChange: (field, value) => console.log('onChange', field, value),
    cartTotal: 500,
  },
};

export const NovaPoshtaSelected: Story = {
  args: {
    data: {
      deliveryMethod: 'nova_poshta',
      deliveryCity: 'Київ',
      deliveryAddress: 'Відділення №15',
    },
    errors: {},
    onChange: (field, value) => console.log('onChange', field, value),
    cartTotal: 1200,
  },
};

export const WithErrors: Story = {
  args: {
    data: {
      deliveryMethod: 'nova_poshta',
    },
    errors: {
      deliveryCity: 'Вкажіть місто',
      deliveryAddress: 'Вкажіть адресу доставки',
    },
    onChange: (field, value) => console.log('onChange', field, value),
    cartTotal: 300,
  },
};
