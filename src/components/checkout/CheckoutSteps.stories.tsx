import type { Meta, StoryObj } from '@storybook/react';
import CheckoutSteps from './CheckoutSteps';

const meta: Meta<typeof CheckoutSteps> = {
  title: 'Checkout/CheckoutSteps',
  component: CheckoutSteps,
  argTypes: {
    currentStep: {
      control: { type: 'range', min: 1, max: 4 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CheckoutSteps>;

export const Step1Contacts: Story = {
  args: { currentStep: 1 },
};

export const Step2Delivery: Story = {
  args: { currentStep: 2 },
};

export const Step3Payment: Story = {
  args: { currentStep: 3 },
};

export const Step4Confirmation: Story = {
  args: { currentStep: 4 },
};
