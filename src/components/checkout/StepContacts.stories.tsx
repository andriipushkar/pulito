import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';
import StepContacts from './StepContacts';

const messages = {
  checkout: {
    stepContacts: 'Контактні дані',
    contactName: "Ім'я та прізвище",
    contactPhone: 'Телефон',
    contactEmail: 'Email',
    companySection: "Для юридичних осіб (необов'язково)",
    companyName: 'Назва компанії',
    edrpou: 'ЄДРПОУ',
  },
};

const meta: Meta<typeof StepContacts> = {
  title: 'Checkout/StepContacts',
  component: StepContacts,
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
type Story = StoryObj<typeof StepContacts>;

export const Empty: Story = {
  args: {
    data: {},
    errors: {},
    onChange: (field, value) => console.log('onChange', field, value),
  },
};

export const Filled: Story = {
  args: {
    data: {
      contactName: 'Іванов Іван',
      contactPhone: '+380501234567',
      contactEmail: 'ivan@example.com',
    },
    errors: {},
    onChange: (field, value) => console.log('onChange', field, value),
  },
};

export const WithErrors: Story = {
  args: {
    data: {
      contactName: '',
      contactPhone: '123',
      contactEmail: 'invalid',
    },
    errors: {
      contactName: "Ім'я обов'язкове",
      contactPhone: 'Невірний формат телефону',
      contactEmail: 'Невірний email',
    },
    onChange: (field, value) => console.log('onChange', field, value),
  },
};
