import type { Meta, StoryObj } from '@storybook/react';
import Select from './Select';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    label: 'Сортування',
    options: [
      { value: 'popular', label: 'За популярністю' },
      { value: 'price-asc', label: 'Від дешевих до дорогих' },
      { value: 'price-desc', label: 'Від дорогих до дешевих' },
      { value: 'new', label: 'Новинки' },
    ],
  },
};

export const WithError: Story = {
  args: {
    label: 'Місто доставки',
    options: [
      { value: '', label: 'Оберіть місто' },
      { value: 'kyiv', label: 'Київ' },
      { value: 'lviv', label: 'Львів' },
      { value: 'odesa', label: 'Одеса' },
    ],
    error: 'Оберіть місто доставки',
  },
};

export const WithoutLabel: Story = {
  args: {
    options: [
      { value: '10', label: '10 на сторінці' },
      { value: '20', label: '20 на сторінці' },
      { value: '50', label: '50 на сторінці' },
    ],
  },
};
