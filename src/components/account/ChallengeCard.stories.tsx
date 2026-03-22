import type { Meta, StoryObj } from '@storybook/react';
import ChallengeCard from './ChallengeCard';

const meta: Meta<typeof ChallengeCard> = {
  title: 'Account/ChallengeCard',
  component: ChallengeCard,
};

export default meta;
type Story = StoryObj<typeof ChallengeCard>;

export const InProgress: Story = {
  args: {
    challenge: {
      id: 1,
      name: 'Зробіть 5 замовлень',
      description: 'Оформіть 5 замовлень протягом місяця та отримайте бонус.',
      type: 'order_count',
      target: 5,
      reward: 200,
      currentValue: 3,
      isCompleted: false,
      isRewarded: false,
      endDate: '2026-04-30T23:59:59Z',
    },
  },
};

export const Completed: Story = {
  args: {
    challenge: {
      id: 2,
      name: 'Залиште відгук',
      description: 'Напишіть відгук з фото та отримайте бонусні бали.',
      type: 'review',
      target: 1,
      reward: 50,
      currentValue: 1,
      isCompleted: true,
      isRewarded: false,
      endDate: null,
    },
  },
};

export const Streak: Story = {
  args: {
    challenge: {
      id: 3,
      name: 'Серія покупок',
      description: 'Зробіть покупку кожного місяця протягом 6 місяців.',
      type: 'streak',
      target: 6,
      reward: 500,
      currentValue: 2,
      isCompleted: false,
      isRewarded: false,
      endDate: null,
    },
  },
};
