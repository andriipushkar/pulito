import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';
import StepPayment from './StepPayment';

const messages = {
  checkout: {
    stepPayment: 'Оплата',
    codDesc: 'Оплата при отриманні (+ комісія перевізника)',
    bankTransferDesc: 'Безготівковий розрахунок на р/р',
    onlineDesc: 'Оплата онлайн картою',
    cardPrepayDesc: 'Передоплата на картку ПриватБанк',
    selectProvider: 'Оберіть платіжну систему',
    liqpayDesc: 'Visa / Mastercard через LiqPay',
    monobankDesc: 'Оплата через Monobank',
    wayforpayDesc: 'Visa / Mastercard через WayForPay',
    paymentComment: 'Коментар до замовлення',
    paymentCommentPlaceholder: 'Додаткові побажання...',
  },
};

const meta: Meta<typeof StepPayment> = {
  title: 'Checkout/StepPayment',
  component: StepPayment,
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
type Story = StoryObj<typeof StepPayment>;

export const NoSelection: Story = {
  args: {
    data: {},
    errors: {},
    onChange: (field, value) => console.log('onChange', field, value),
  },
};

export const CODSelected: Story = {
  args: {
    data: { paymentMethod: 'cod' },
    errors: {},
    onChange: (field, value) => console.log('onChange', field, value),
  },
};

export const OnlineWithProvider: Story = {
  args: {
    data: { paymentMethod: 'online', paymentProvider: 'monobank' },
    errors: {},
    onChange: (field, value) => console.log('onChange', field, value),
  },
};
