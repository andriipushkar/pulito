'use client';

import { useState, useRef } from 'react';

interface SwipeableCartItemProps {
  children: React.ReactNode;
  onDelete: () => void;
}

/**
 * Wrapper that adds swipe-to-delete gesture for cart items on mobile.
 * Swipe left reveals a red delete button behind the item.
 */
export default function SwipeableCartItem({ children, onDelete }: SwipeableCartItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isTracking = useRef(false);

  const DELETE_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isTracking.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isTracking.current) return;

    const diffX = e.touches[0].clientX - startX.current;
    const diffY = e.touches[0].clientY - startY.current;

    // If vertical scroll, stop tracking
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
      isTracking.current = false;
      return;
    }

    // Only allow swipe left (negative offset)
    if (diffX < 0) {
      setOffsetX(Math.max(diffX, -120));
    } else if (isRevealed) {
      setOffsetX(Math.min(0, -120 + diffX));
    }
  };

  const handleTouchEnd = () => {
    isTracking.current = false;

    if (offsetX < -DELETE_THRESHOLD) {
      setIsRevealed(true);
      setOffsetX(-120);
    } else {
      setIsRevealed(false);
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl md:overflow-visible">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex w-[120px] items-center justify-center bg-red-500 md:hidden">
        <button
          onClick={onDelete}
          className="flex flex-col items-center gap-1 text-white"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs font-semibold">Видалити</span>
        </button>
      </div>

      {/* Main content */}
      <div
        className="relative bg-white transition-transform duration-200 ease-out md:!translate-x-0"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
