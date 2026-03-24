import type { Meta, StoryObj } from '@storybook/react';
import AriaLiveRegion, { announce } from './AriaLiveRegion';

const meta: Meta<typeof AriaLiveRegion> = {
  title: 'UI/AriaLiveRegion',
  component: AriaLiveRegion,
};

export default meta;
type Story = StoryObj<typeof AriaLiveRegion>;

export const Default: Story = {
  render: () => (
    <div className="space-y-4">
      <AriaLiveRegion />
      <p className="text-sm text-gray-500">
        Цей компонент невидимий (sr-only). Натисніть кнопку щоб оголосити повідомлення для
        скрінрідера.
      </p>
      <button
        onClick={() => announce('Товар додано до кошика')}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        Оголосити повідомлення
      </button>
    </div>
  ),
};

export const MultipleAnnouncements: Story = {
  render: () => {
    let counter = 0;
    return (
      <div className="space-y-4">
        <AriaLiveRegion />
        <p className="text-sm text-gray-500">
          Натисніть кілька разів щоб додати кілька повідомлень.
        </p>
        <button
          onClick={() => {
            counter++;
            announce(`Повідомлення #${counter}`);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Додати повідомлення
        </button>
      </div>
    );
  },
};
