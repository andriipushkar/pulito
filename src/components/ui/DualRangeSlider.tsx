'use client';

import { useCallback, useRef, useState } from 'react';

export interface DualRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  formatLabel?: (value: number) => string;
}

export default function DualRangeSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  formatLabel = (v) => String(v),
}: DualRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  const clamp = useCallback(
    (v: number) => Math.round(Math.max(min, Math.min(max, v)) / step) * step,
    [min, max, step],
  );

  const getPercent = (v: number) => ((v - min) / (max - min)) * 100;

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return clamp(min + fraction * (max - min));
    },
    [min, max, clamp],
  );

  const handlePointerDown = (thumb: 'min' | 'max') => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(thumb);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const newVal = getValueFromPosition(e.clientX);
      if (dragging === 'min') {
        onChange([Math.min(newVal, value[1]), value[1]]);
      } else {
        onChange([value[0], Math.max(newVal, value[0])]);
      }
    },
    [dragging, value, onChange, getValueFromPosition],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const leftPercent = getPercent(value[0]);
  const rightPercent = getPercent(value[1]);

  return (
    <div className="select-none">
      {/* Labels above thumbs */}
      <div className="relative mb-1 h-5">
        <span
          className="absolute -translate-x-1/2 text-xs font-medium text-[var(--color-text)]"
          style={{ left: `${leftPercent}%` }}
        >
          {formatLabel(value[0])}
        </span>
        <span
          className="absolute -translate-x-1/2 text-xs font-medium text-[var(--color-text)]"
          style={{ left: `${rightPercent}%` }}
        >
          {formatLabel(value[1])}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-6"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Background track */}
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-[var(--color-border)]" />

        {/* Active fill */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-[var(--color-primary)]"
          style={{
            left: `${leftPercent}%`,
            right: `${100 - rightPercent}%`,
          }}
        />

        {/* Min thumb */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Мінімальна ціна"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value[0]}
          className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-[var(--color-primary)] bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
          style={{ left: `${leftPercent}%` }}
          onPointerDown={handlePointerDown('min')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              const newVal = clamp(value[0] + step);
              onChange([Math.min(newVal, value[1]), value[1]]);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              const newVal = clamp(value[0] - step);
              onChange([Math.max(newVal, min), value[1]]);
            }
          }}
        />

        {/* Max thumb */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Максимальна ціна"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value[1]}
          className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-[var(--color-primary)] bg-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
          style={{ left: `${rightPercent}%` }}
          onPointerDown={handlePointerDown('max')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              const newVal = clamp(value[1] + step);
              onChange([value[0], Math.min(newVal, max)]);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              const newVal = clamp(value[1] - step);
              onChange([value[0], Math.max(newVal, value[0])]);
            }
          }}
        />
      </div>

      {/* Hidden range inputs for form compatibility */}
      <input type="hidden" name="price_min" value={value[0]} />
      <input type="hidden" name="price_max" value={value[1]} />
    </div>
  );
}
