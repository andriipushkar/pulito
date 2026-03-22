import type { Meta, StoryObj } from '@storybook/react';
import Badge from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  argTypes: {
    color: { control: 'color' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Promo: Story = {
  args: { children: 'promo' },
};

export const NewArrival: Story = {
  args: { children: 'new_arrival' },
};

export const Hit: Story = {
  args: { children: 'hit' },
};

export const Eco: Story = {
  args: { children: 'eco' },
};

export const CustomColor: Story = {
  args: { children: 'Знижка', color: '#E91E63' },
};

export const DefaultFallback: Story = {
  args: { children: 'Unknown' },
};
