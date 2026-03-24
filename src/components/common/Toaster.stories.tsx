import type { Meta, StoryObj } from '@storybook/react';
import { toast } from 'sonner';
import Toaster from './Toaster';

const meta: Meta<typeof Toaster> = {
  title: 'Common/Toaster',
  component: Toaster,
};
export default meta;
type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div>
      <Toaster />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => toast.success('Товар додано до кошика!')}
          className="rounded bg-green-600 px-3 py-2 text-sm text-white"
        >
          Success Toast
        </button>
        <button
          onClick={() => toast.error('Помилка при оформленні')}
          className="rounded bg-red-600 px-3 py-2 text-sm text-white"
        >
          Error Toast
        </button>
        <button
          onClick={() => toast.info('Оновлення доступне')}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
        >
          Info Toast
        </button>
      </div>
    </div>
  ),
};

export const SuccessOnly: Story = {
  render: () => (
    <div>
      <Toaster />
      <button
        onClick={() => toast.success('Замовлення оформлено!')}
        className="rounded bg-green-600 px-3 py-2 text-sm text-white"
      >
        Show Success
      </button>
    </div>
  ),
};

export const ErrorOnly: Story = {
  render: () => (
    <div>
      <Toaster />
      <button
        onClick={() => toast.error('Щось пішло не так. Спробуйте ще раз.')}
        className="rounded bg-red-600 px-3 py-2 text-sm text-white"
      >
        Show Error
      </button>
    </div>
  ),
};
