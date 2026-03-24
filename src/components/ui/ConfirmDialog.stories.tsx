import type { Meta, StoryObj } from '@storybook/react';
import ConfirmDialog from './ConfirmDialog';

const meta: Meta<typeof ConfirmDialog> = {
  title: 'UI/ConfirmDialog',
  component: ConfirmDialog,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'danger', 'warning'],
    },
    isLoading: { control: 'boolean' },
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
type Story = StoryObj<typeof ConfirmDialog>;

export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Підтвердження',
    message: 'Ви впевнені, що хочете продовжити цю дію?',
    confirmText: 'Підтвердити',
    cancelText: 'Скасувати',
    variant: 'default',
  },
};

export const Danger: Story = {
  args: {
    isOpen: true,
    title: 'Видалити товар?',
    message: 'Цю дію неможливо скасувати. Товар буде видалено назавжди.',
    confirmText: 'Видалити',
    cancelText: 'Скасувати',
    variant: 'danger',
  },
};

export const Warning: Story = {
  args: {
    isOpen: true,
    title: 'Скасувати замовлення?',
    message: 'Замовлення буде скасовано і кошти повернуто протягом 3-5 днів.',
    confirmText: 'Так, скасувати',
    cancelText: 'Ні, залишити',
    variant: 'warning',
  },
};

export const Loading: Story = {
  args: {
    isOpen: true,
    title: 'Видалити обліковий запис?',
    message: 'Усі ваші дані будуть видалені без можливості відновлення.',
    confirmText: 'Видалити',
    variant: 'danger',
    isLoading: true,
  },
};
