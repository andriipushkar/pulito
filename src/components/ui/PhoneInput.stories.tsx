import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import PhoneInput from './PhoneInput';

const meta: Meta<typeof PhoneInput> = {
  title: 'UI/PhoneInput',
  component: PhoneInput,
};

export default meta;
type Story = StoryObj<typeof PhoneInput>;

function DefaultRender() {
  const [value, setValue] = useState('');
  return (
    <div className="max-w-sm">
      <PhoneInput label="Номер телефону" value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}

export const Default: Story = {
  render: () => <DefaultRender />,
};

function WithValueRender() {
  const [value, setValue] = useState('+38 (067) 123-45-67');
  return (
    <div className="max-w-sm">
      <PhoneInput label="Номер телефону" value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}

export const WithValue: Story = {
  render: () => <WithValueRender />,
};

function WithErrorRender() {
  const [value, setValue] = useState('+38 (067) 123');
  return (
    <div className="max-w-sm">
      <PhoneInput
        label="Номер телефону"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error="Введіть повний номер телефону"
      />
    </div>
  );
}

export const WithError: Story = {
  render: () => <WithErrorRender />,
};
