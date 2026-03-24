import type { Meta, StoryObj } from '@storybook/react';
import AnimateOnScroll from './AnimateOnScroll';

const meta: Meta<typeof AnimateOnScroll> = {
  title: 'UI/AnimateOnScroll',
  component: AnimateOnScroll,
};

export default meta;
type Story = StoryObj<typeof AnimateOnScroll>;

export const Default: Story = {
  args: {
    children: (
      <div className="rounded-lg bg-blue-50 p-8 text-center text-sm text-blue-700">
        Цей блок зʼявляється з анімацією при прокрутці
      </div>
    ),
  },
};

export const WithDelay: Story = {
  render: () => (
    <div className="space-y-4">
      <AnimateOnScroll delay={0}>
        <div className="rounded-lg bg-green-50 p-6 text-center text-sm text-green-700">
          Без затримки
        </div>
      </AnimateOnScroll>
      <AnimateOnScroll delay={200}>
        <div className="rounded-lg bg-yellow-50 p-6 text-center text-sm text-yellow-700">
          Затримка 200ms
        </div>
      </AnimateOnScroll>
      <AnimateOnScroll delay={400}>
        <div className="rounded-lg bg-red-50 p-6 text-center text-sm text-red-700">
          Затримка 400ms
        </div>
      </AnimateOnScroll>
    </div>
  ),
};
