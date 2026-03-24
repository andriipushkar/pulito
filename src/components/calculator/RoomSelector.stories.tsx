import type { Meta, StoryObj } from '@storybook/react';
import RoomSelector from './RoomSelector';
import type { RoomConfig } from './RoomSelector';

const meta: Meta<typeof RoomSelector> = {
  title: 'Calculator/RoomSelector',
  component: RoomSelector,
  args: {
    rooms: [],
    onChange: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof RoomSelector>;

export const Empty: Story = {
  args: { rooms: [] },
};

export const WithSelectedRooms: Story = {
  args: {
    rooms: [
      { type: 'kitchen', area: 12, count: 1 },
      { type: 'bathroom', area: 6, count: 2 },
      { type: 'living_room', area: 25, count: 1 },
    ] as RoomConfig[],
  },
};
