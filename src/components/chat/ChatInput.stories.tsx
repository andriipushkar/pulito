import type { Meta, StoryObj } from '@storybook/react';
import ChatInput from './ChatInput';

const meta: Meta<typeof ChatInput> = {
  title: 'Chat/ChatInput',
  component: ChatInput,
};
export default meta;
type Story = StoryObj<typeof ChatInput>;

export const Default: Story = {
  args: {
    onSend: (content: string) => console.log('Send:', content),
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    onSend: () => {},
    disabled: true,
  },
};

export const CustomPlaceholder: Story = {
  args: {
    onSend: (content: string) => console.log('Send:', content),
    disabled: false,
    placeholder: 'Напишіть ваше питання...',
  },
};
