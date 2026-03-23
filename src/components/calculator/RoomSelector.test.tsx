// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import RoomSelector, { type RoomConfig } from './RoomSelector';

describe('RoomSelector', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    rooms: [] as RoomConfig[],
    onChange: vi.fn(),
  };

  it('renders all six room type options', () => {
    render(<RoomSelector {...defaultProps} />);

    expect(screen.getByTestId('room-option-kitchen')).toBeInTheDocument();
    expect(screen.getByTestId('room-option-bathroom')).toBeInTheDocument();
    expect(screen.getByTestId('room-option-bedroom')).toBeInTheDocument();
    expect(screen.getByTestId('room-option-living_room')).toBeInTheDocument();
    expect(screen.getByTestId('room-option-hallway')).toBeInTheDocument();
    expect(screen.getByTestId('room-option-office')).toBeInTheDocument();
  });

  it('adds a room when clicking a room option', () => {
    const onChange = vi.fn();
    render(<RoomSelector rooms={[]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('room-option-kitchen'));

    expect(onChange).toHaveBeenCalledWith([
      { type: 'kitchen', area: 12, count: 1 },
    ]);
  });

  it('removes a room when clicking a selected room option', () => {
    const onChange = vi.fn();
    const rooms: RoomConfig[] = [{ type: 'kitchen', area: 12, count: 1 }];
    render(<RoomSelector rooms={rooms} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('room-option-kitchen'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows area input for a selected room', () => {
    const rooms: RoomConfig[] = [{ type: 'bathroom', area: 6, count: 1 }];
    render(<RoomSelector rooms={rooms} onChange={vi.fn()} />);

    expect(screen.getByTestId('room-config-bathroom')).toBeInTheDocument();
    const areaInput = screen.getByLabelText('Площа:');
    expect(areaInput).toHaveValue(6);
  });

  it('shows count input for a selected room', () => {
    const rooms: RoomConfig[] = [{ type: 'bathroom', area: 6, count: 2 }];
    render(<RoomSelector rooms={rooms} onChange={vi.fn()} />);

    const countInput = screen.getByLabelText('Кількість:');
    expect(countInput).toHaveValue(2);
  });

  it('emits updated config when area is changed', () => {
    const onChange = vi.fn();
    const rooms: RoomConfig[] = [{ type: 'bedroom', area: 16, count: 1 }];
    render(<RoomSelector rooms={rooms} onChange={onChange} />);

    const areaInput = screen.getByLabelText('Площа:');
    fireEvent.change(areaInput, { target: { value: '20' } });

    expect(onChange).toHaveBeenCalledWith([{ type: 'bedroom', area: 20, count: 1 }]);
  });

  it('shows summary text when rooms are selected', () => {
    const rooms: RoomConfig[] = [
      { type: 'kitchen', area: 12, count: 1 },
      { type: 'bathroom', area: 6, count: 2 },
      { type: 'bedroom', area: 16, count: 1 },
      { type: 'living_room', area: 20, count: 1 },
    ];
    render(<RoomSelector rooms={rooms} onChange={vi.fn()} />);

    const summary = screen.getByTestId('room-summary');
    expect(summary).toHaveTextContent('Обрано 4 кімнати');
    // total area: 12*1 + 6*2 + 16*1 + 20*1 = 60
    expect(summary).toHaveTextContent('60');
  });
});
