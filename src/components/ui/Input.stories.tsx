import type { Meta, StoryObj } from '@storybook/react';
import Input from './Input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  argTypes: {
    label: { control: 'text' },
    error: { control: 'text' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Введіть текст...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Електронна пошта',
    placeholder: 'email@example.com',
    type: 'email',
  },
};

export const WithError: Story = {
  args: {
    label: 'Пароль',
    type: 'password',
    error: 'Пароль повинен містити мінімум 8 символів',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Телефон',
    placeholder: '+380 XX XXX XXXX',
    disabled: true,
  },
};
