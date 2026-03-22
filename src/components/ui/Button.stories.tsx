import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Додати в кошик', variant: 'primary', size: 'md' },
};

export const Secondary: Story = {
  args: { children: 'Детальніше', variant: 'secondary', size: 'md' },
};

export const Outline: Story = {
  args: { children: 'Скасувати', variant: 'outline', size: 'md' },
};

export const Ghost: Story = {
  args: { children: 'Ще', variant: 'ghost', size: 'sm' },
};

export const Danger: Story = {
  args: { children: 'Видалити', variant: 'danger', size: 'md' },
};

export const Loading: Story = {
  args: { children: 'Завантаження...', variant: 'primary', isLoading: true },
};

export const Large: Story = {
  args: { children: 'Оформити замовлення', variant: 'primary', size: 'lg' },
};

export const Disabled: Story = {
  args: { children: 'Недоступно', variant: 'primary', disabled: true },
};
