import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import DualRangeSlider from './DualRangeSlider';

const meta: Meta<typeof DualRangeSlider> = {
  title: 'UI/DualRangeSlider',
  component: DualRangeSlider,
};

export default meta;
type Story = StoryObj<typeof DualRangeSlider>;

function DefaultRender() {
  const [value, setValue] = useState<[number, number]>([100, 800]);
  return (
    <div className="max-w-md p-4">
      <DualRangeSlider min={0} max={1000} value={value} onChange={setValue} />
    </div>
  );
}

export const Default: Story = {
  render: () => <DefaultRender />,
};

function WithCurrencyFormatRender() {
  const [value, setValue] = useState<[number, number]>([200, 1500]);
  return (
    <div className="max-w-md p-4">
      <DualRangeSlider
        min={0}
        max={2000}
        value={value}
        onChange={setValue}
        step={50}
        formatLabel={(v) => `${v} грн`}
      />
    </div>
  );
}

export const WithCurrencyFormat: Story = {
  render: () => <WithCurrencyFormatRender />,
};

function SmallRangeRender() {
  const [value, setValue] = useState<[number, number]>([2, 8]);
  return (
    <div className="max-w-md p-4">
      <DualRangeSlider min={1} max={10} value={value} onChange={setValue} step={1} />
    </div>
  );
}

export const SmallRange: Story = {
  render: () => <SmallRangeRender />,
};
