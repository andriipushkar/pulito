// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSwipeAction } from './useSwipeAction';

function makeTouchEvent(clientX: number, clientY: number) {
  return {
    touches: [{ clientX, clientY }],
    changedTouches: [{ clientX, clientY }],
  } as unknown as React.TouchEvent;
}

describe('useSwipeAction', () => {
  it('returns onTouchStart and onTouchEnd handlers', () => {
    const { result } = renderHook(() => useSwipeAction({}));

    expect(typeof result.current.onTouchStart).toBe('function');
    expect(typeof result.current.onTouchEnd).toBe('function');
  });

  it('detects swipe left', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeLeft, threshold: 80 })
    );

    result.current.onTouchStart(makeTouchEvent(300, 100));
    result.current.onTouchEnd(makeTouchEvent(100, 100)); // -200px, well past threshold

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('detects swipe right', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeRight, threshold: 80 })
    );

    result.current.onTouchStart(makeTouchEvent(100, 100));
    result.current.onTouchEnd(makeTouchEvent(300, 100)); // +200px

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('does not fire when below threshold', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeLeft, onSwipeRight, threshold: 80 })
    );

    result.current.onTouchStart(makeTouchEvent(100, 100));
    result.current.onTouchEnd(makeTouchEvent(150, 100)); // +50px, below threshold

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('does not fire when vertical movement exceeds horizontal', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeLeft, threshold: 80 })
    );

    // Horizontal = -100, Vertical = -200 (scrolling)
    result.current.onTouchStart(makeTouchEvent(300, 300));
    result.current.onTouchEnd(makeTouchEvent(200, 100));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('uses default threshold of 80', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeLeft })
    );

    // Just under 80 - should not fire
    result.current.onTouchStart(makeTouchEvent(200, 100));
    result.current.onTouchEnd(makeTouchEvent(125, 100)); // -75px

    expect(onSwipeLeft).not.toHaveBeenCalled();

    // Just over 80 - should fire
    result.current.onTouchStart(makeTouchEvent(200, 100));
    result.current.onTouchEnd(makeTouchEvent(100, 100)); // -100px

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('supports custom threshold', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeRight, threshold: 30 })
    );

    result.current.onTouchStart(makeTouchEvent(100, 100));
    result.current.onTouchEnd(makeTouchEvent(140, 100)); // +40px, past threshold of 30

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('does not fire if no callback provided for that direction', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeRight, threshold: 80 })
    );

    // Swipe left, but no onSwipeLeft callback
    result.current.onTouchStart(makeTouchEvent(300, 100));
    result.current.onTouchEnd(makeTouchEvent(100, 100));

    expect(onSwipeRight).not.toHaveBeenCalled(); // onSwipeRight not triggered for left swipe
  });

  it('does not fire on touchEnd without prior touchStart', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeAction({ onSwipeLeft, threshold: 80 })
    );

    // Only touchEnd without touchStart - isDragging is false by default
    result.current.onTouchEnd(makeTouchEvent(100, 100));

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
