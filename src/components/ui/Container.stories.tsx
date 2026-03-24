import type { Meta, StoryObj } from '@storybook/react';
import Container from './Container';

const meta: Meta<typeof Container> = {
  title: 'UI/Container',
  component: Container,
};

export default meta;
type Story = StoryObj<typeof Container>;

export const Default: Story = {
  args: {
    children: (
      <div className="rounded-lg bg-blue-50 p-8 text-center text-sm text-blue-700">
        Контент всередині Container (max-width: 1440px, з горизонтальними відступами)
      </div>
    ),
  },
};

export const WithContent: Story = {
  args: {
    children: (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg bg-gray-100 p-6 text-center text-sm">
            Колонка {i}
          </div>
        ))}
      </div>
    ),
  },
};
