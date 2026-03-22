import type { Meta, StoryObj } from '@storybook/react';
import BulkOrderForm from './BulkOrderForm';

const meta: Meta<typeof BulkOrderForm> = {
  title: 'Wholesale/BulkOrderForm',
  component: BulkOrderForm,
};

export default meta;
type Story = StoryObj<typeof BulkOrderForm>;

export const Default: Story = {};
