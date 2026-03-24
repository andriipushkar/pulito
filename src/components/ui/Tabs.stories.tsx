import type { Meta, StoryObj } from '@storybook/react';
import Tabs from './Tabs';

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  args: {
    tabs: [
      {
        id: 'description',
        label: 'Опис',
        content: (
          <p className="text-sm">
            Професійний засіб для очищення всіх типів поверхонь. Ефективно видаляє бруд та жир.
          </p>
        ),
      },
      {
        id: 'specs',
        label: 'Характеристики',
        content: <p className="text-sm">Обʼєм: 500 мл. Склад: ПАР, ароматизатор, вода.</p>,
      },
      {
        id: 'reviews',
        label: 'Відгуки (12)',
        content: <p className="text-sm">Чудовий засіб! Рекомендую всім.</p>,
      },
    ],
  },
};

export const WithDefaultTab: Story = {
  args: {
    tabs: [
      {
        id: 'delivery',
        label: 'Доставка',
        content: <p className="text-sm">Безкоштовна доставка від 1000 грн.</p>,
      },
      {
        id: 'payment',
        label: 'Оплата',
        content: <p className="text-sm">Картка, готівка, накладений платіж.</p>,
      },
      {
        id: 'return',
        label: 'Повернення',
        content: <p className="text-sm">14 днів на повернення.</p>,
      },
    ],
    defaultTab: 'payment',
  },
};

export const TwoTabs: Story = {
  args: {
    tabs: [
      {
        id: 'active',
        label: 'Активні',
        content: <p className="text-sm">У вас 3 активних замовлення.</p>,
      },
      {
        id: 'history',
        label: 'Історія',
        content: <p className="text-sm">Переглянуті замовлення за останні 30 днів.</p>,
      },
    ],
  },
};
