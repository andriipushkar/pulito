'use client';

import { useMemo, useCallback } from 'react';

export type RoomType = 'kitchen' | 'bathroom' | 'bedroom' | 'living_room' | 'hallway' | 'office';

export interface RoomConfig {
  type: RoomType;
  area: number;
  count: number;
}

interface RoomOption {
  type: RoomType;
  label: string;
  icon: string;
  defaultArea: number;
}

const ROOM_OPTIONS: RoomOption[] = [
  { type: 'kitchen', label: 'Кухня', icon: '🍳', defaultArea: 12 },
  { type: 'bathroom', label: 'Ванна кімната', icon: '🚿', defaultArea: 6 },
  { type: 'bedroom', label: 'Спальня', icon: '🛏️', defaultArea: 16 },
  { type: 'living_room', label: 'Вітальня', icon: '🛋️', defaultArea: 20 },
  { type: 'hallway', label: 'Коридор', icon: '🚪', defaultArea: 8 },
  { type: 'office', label: 'Кабінет', icon: '💼', defaultArea: 12 },
];

interface RoomSelectorProps {
  rooms: RoomConfig[];
  onChange: (rooms: RoomConfig[]) => void;
}

export default function RoomSelector({ rooms, onChange }: RoomSelectorProps) {
  const selectedTypes = useMemo(() => new Set(rooms.map((r) => r.type)), [rooms]);

  const toggleRoom = useCallback(
    (option: RoomOption) => {
      if (selectedTypes.has(option.type)) {
        onChange(rooms.filter((r) => r.type !== option.type));
      } else {
        onChange([...rooms, { type: option.type, area: option.defaultArea, count: 1 }]);
      }
    },
    [rooms, onChange, selectedTypes]
  );

  const updateRoom = useCallback(
    (type: RoomType, field: 'area' | 'count', value: number) => {
      onChange(rooms.map((r) => (r.type === type ? { ...r, [field]: value } : r)));
    },
    [rooms, onChange]
  );

  const totalArea = rooms.reduce((s, r) => s + r.area * r.count, 0);

  return (
    <div className="space-y-4">
      {/* Room type cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ROOM_OPTIONS.map((option) => {
          const isSelected = selectedTypes.has(option.type);
          return (
            <button
              key={option.type}
              type="button"
              data-testid={`room-option-${option.type}`}
              onClick={() => toggleRoom(option)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-center transition-all ${
                isSelected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] shadow-sm'
                  : 'border-[var(--color-border)] bg-white hover:border-[var(--color-primary-light)]'
              }`}
            >
              <span className="text-2xl">{option.icon}</span>
              <span className={`text-sm font-medium ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Configuration for selected rooms */}
      {rooms.length > 0 && (
        <div className="space-y-3">
          {rooms.map((room) => {
            const option = ROOM_OPTIONS.find((o) => o.type === room.type)!;
            return (
              <div
                key={room.type}
                data-testid={`room-config-${room.type}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4"
              >
                <span className="text-lg">{option.icon}</span>
                <span className="min-w-[100px] text-sm font-semibold text-[var(--color-text)]">
                  {option.label}
                </span>

                <div className="flex items-center gap-1.5">
                  <label htmlFor={`area-${room.type}`} className="text-xs text-[var(--color-text-secondary)]">
                    Площа:
                  </label>
                  <input
                    id={`area-${room.type}`}
                    type="number"
                    min={1}
                    max={200}
                    value={room.area}
                    onChange={(e) => updateRoom(room.type, 'area', Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                  <span className="text-xs text-[var(--color-text-secondary)]">м&sup2;</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <label htmlFor={`count-${room.type}`} className="text-xs text-[var(--color-text-secondary)]">
                    Кількість:
                  </label>
                  <input
                    id={`count-${room.type}`}
                    type="number"
                    min={1}
                    max={10}
                    value={room.count}
                    onChange={(e) => updateRoom(room.type, 'count', Math.max(1, Number(e.target.value) || 1))}
                    className="w-14 rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {rooms.length > 0 && (
        <p data-testid="room-summary" className="text-sm font-medium text-[var(--color-text-secondary)]">
          Обрано {rooms.length} {rooms.length === 1 ? 'кімнату' : rooms.length < 5 ? 'кімнати' : 'кімнат'},{' '}
          {totalArea} м&sup2;
        </p>
      )}
    </div>
  );
}
