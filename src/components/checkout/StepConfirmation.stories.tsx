import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';
import StepConfirmation from './StepConfirmation';
import type { CartItem } from '@/providers/CartProvider';

const messages = {
  checkout: {
    reviewOrder: 'Перевірте замовлення',
    contactInfo: 'Контактні дані',
    deliveryInfo: 'Доставка',
    paymentInfo: 'Оплата',
    items: 'Товари',
    edrpou: 'ЄДРПОУ',
    paymentComment: 'Коментар',
    loyaltyPoints: 'Бонусні бали',
    availablePoints: 'Доступно балів',
    usePoints: 'Використати',
    pointsDiscount: 'Знижка балами',
  },
  common: {
    total: 'Разом',
    currency: '₴',
  },
};

const mockItems: CartItem[] = [
  {
    productId: 1,
    name: 'Засіб для миття підлоги 1л',
    slug: 'zasib-pidloga-1l',
    code: 'CLN-101',
    priceRetail: 89.99,
    priceWholesale: null,
    imagePath: null,
    quantity: 2,
    maxQuantity: 50,
  },
  {
    productId: 2,
    name: 'Рушники паперові 8шт',
    slug: 'rushnyky-paperovi-8sht',
    code: 'CLN-202',
    priceRetail: 159.0,
    priceWholesale: null,
    imagePath: null,
    quantity: 1,
    maxQuantity: 100,
  },
];

const meta: Meta<typeof StepConfirmation> = {
  title: 'Checkout/StepConfirmation',
  component: StepConfirmation,
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
type Story = StoryObj<typeof StepConfirmation>;

export const Default: Story = {
  args: {
    data: {
      contactName: 'Іванов Іван',
      contactPhone: '+380501234567',
      contactEmail: 'ivan@example.com',
      deliveryMethod: 'nova_poshta',
      deliveryCity: 'Київ',
      deliveryAddress: 'Відділення №15',
      paymentMethod: 'cod',
    },
    items: mockItems,
    total: 338.98,
  },
};

export const WithCompany: Story = {
  args: {
    data: {
      contactName: 'Петренко Петро',
      contactPhone: '+380671112233',
      contactEmail: 'petro@company.ua',
      companyName: 'ТОВ "Клін Сервіс"',
      edrpou: '12345678',
      deliveryMethod: 'ukrposhta',
      deliveryCity: 'Львів',
      deliveryAddress: 'вул. Шевченка, 10',
      paymentMethod: 'bank_transfer',
      comment: 'Доставити до 15:00',
    },
    items: mockItems,
    total: 338.98,
  },
};

export const WithLoyaltyPoints: Story = {
  args: {
    data: {
      contactName: 'Сидоренко Анна',
      contactPhone: '+380931234567',
      contactEmail: 'anna@example.com',
      deliveryMethod: 'nova_poshta',
      deliveryCity: 'Одеса',
      deliveryAddress: 'Відділення №3',
      paymentMethod: 'online',
    },
    items: mockItems,
    total: 338.98,
    loyaltyPoints: 200,
    loyaltyPointsToSpend: 50,
    onLoyaltyPointsChange: (pts) => console.log('loyaltyPoints', pts),
  },
};
