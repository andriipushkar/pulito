import { useRef, useCallback } from 'react';

interface SwipeConfig {
  threshold?: number; // min distance in px to trigger (default 80)
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Hook for detecting horizontal swipe gestures on touch devices.
 * Returns ref to attach to the swipeable element and handlers.
 */
export function useSwipeAction({ threshold = 80, onSwipeLeft, onSwipeRight }: SwipeConfig) {
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - startX.current;
    const diffY = endY - startY.current;

    // Only trigger if horizontal movement > vertical (not a scroll)
    if (Math.abs(diffX) < threshold || Math.abs(diffX) < Math.abs(diffY)) return;

    if (diffX < -threshold && onSwipeLeft) {
      onSwipeLeft();
    } else if (diffX > threshold && onSwipeRight) {
      onSwipeRight();
    }
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchEnd };
}
