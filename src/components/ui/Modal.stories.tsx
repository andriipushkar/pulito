import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import Modal from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  argTypes: {
    isOpen: { control: 'boolean' },
    title: { control: 'text' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'full'],
    },
  },
  decorators: [
    (Story) => (
      <div id="modal-root">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Open: Story = {
  args: {
    isOpen: true,
    title: 'Підтвердження',
    children: (
      <div className="p-6">
        <p>Ви впевнені, що хочете продовжити?</p>
      </div>
    ),
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    title: 'Закритий модал',
    children: <div className="p-6"><p>Цей контент не видно.</p></div>,
  },
};

export const WithTitle: Story = {
  args: {
    isOpen: true,
    title: 'Додати товар до кошика',
    children: (
      <div className="p-6">
        <p>Товар успішно додано до кошика!</p>
      </div>
    ),
  },
};

export const WithActions: Story = {
  args: {
    isOpen: true,
    title: 'Видалити товар?',
    children: (
      <div className="p-6">
        <p className="mb-4">Ви впевнені, що хочете видалити цей товар?</p>
        <div className="flex justify-end gap-3">
          <button className="rounded-lg border px-4 py-2 text-sm">Скасувати</button>
          <button className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white">Видалити</button>
        </div>
      </div>
    ),
  },
};

export const LargeSize: Story = {
  args: {
    isOpen: true,
    title: 'Великий модал',
    size: 'lg',
    children: (
      <div className="p-6">
        <p>Це великий модал з розширеним контентом.</p>
      </div>
    ),
  },
};
