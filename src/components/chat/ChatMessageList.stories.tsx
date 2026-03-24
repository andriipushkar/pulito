import type { Meta, StoryObj } from '@storybook/react';
import ChatMessageList from './ChatMessageList';

const meta: Meta<typeof ChatMessageList> = {
  title: 'Chat/ChatMessageList',
  component: ChatMessageList,
  decorators: [
    (Story) => (
      <div className="mx-auto h-[400px] max-w-md overflow-hidden rounded-xl border border-gray-200">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ChatMessageList>;

const now = new Date().toISOString();
const earlier = new Date(Date.now() - 300000).toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();

export const Default: Story = {
  args: {
    messages: [
      {
        id: 1,
        senderType: 'system' as const,
        content: 'Чат розпочато',
        createdAt: yesterday,
        isRead: true,
      },
      {
        id: 2,
        senderType: 'customer' as const,
        senderId: 1,
        content: 'Доброго дня! Хочу дізнатися про доставку.',
        createdAt: yesterday,
        isRead: true,
      },
      {
        id: 3,
        senderType: 'agent' as const,
        senderId: 10,
        content: 'Вітаємо! Доставка по Україні 1-3 робочих дні. Безкоштовно від 500 грн.',
        createdAt: earlier,
        isRead: true,
      },
      {
        id: 4,
        senderType: 'customer' as const,
        senderId: 1,
        content: 'Дякую! А можна самовивозом?',
        createdAt: now,
        isRead: false,
      },
    ],
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    messages: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    messages: [],
    isLoading: false,
  },
};
