// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import SwipeableCartItem from './SwipeableCartItem';

describe('SwipeableCartItem', () => {
  const onDelete = vi.fn();

  it('renders children', () => {
    render(
      <SwipeableCartItem onDelete={onDelete}>
        <div>Cart Item Content</div>
      </SwipeableCartItem>
    );
    expect(screen.getByText('Cart Item Content')).toBeInTheDocument();
  });

  it('renders delete button behind', () => {
    render(
      <SwipeableCartItem onDelete={onDelete}>
        <div>Item</div>
      </SwipeableCartItem>
    );
    expect(screen.getByText('Видалити')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    onDelete.mockClear();
    render(
      <SwipeableCartItem onDelete={onDelete}>
        <div>Item</div>
      </SwipeableCartItem>
    );
    fireEvent.click(screen.getByText('Видалити'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('starts with zero offset', () => {
    const { container } = render(
      <SwipeableCartItem onDelete={onDelete}>
        <div>Item</div>
      </SwipeableCartItem>
    );
    const content = container.querySelector('[style*="translateX"]') as HTMLElement;
    expect(content.style.transform).toBe('translateX(0px)');
  });

  it('applies offset on touch swipe left', () => {
    const { container } = render(
      <SwipeableCartItem onDelete={onDelete}>
        <div>Item</div>
      </SwipeableCartItem>
    );
    const content = container.querySelector('[style*="translateX"]') as HTMLElement;

    fireEvent.touchStart(content, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(content, { touches: [{ clientX: 150, clientY: 100 }] });

    expect(content.style.transform).toBe('translateX(-50px)');
  });

  it('snaps to revealed state when swipe passes threshold', () => {
    const { container } = render(
      <SwipeableCartItem onDelete={onDelete}>
        <div>Item</div>
      </SwipeableCartItem>
    );
    const content = container.querySelector('[style*="translateX"]') as HTMLElement;

    fireEvent.touchStart(content, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(content, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(content);

    expect(content.style.transform).toBe('translateX(-120px)');
  });

  it('resets to zero when swipe does not pass threshold', () => {
    const { container } = render(
      <SwipeableCartItem onDelete={onDelete}>
        <div>Item</div>
      </SwipeableCartItem>
    );
    const content = container.querySelector('[style*="translateX"]') as HTMLElement;

    fireEvent.touchStart(content, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(content, { touches: [{ clientX: 170, clientY: 100 }] });
    fireEvent.touchEnd(content);

    expect(content.style.transform).toBe('translateX(0px)');
  });
});
