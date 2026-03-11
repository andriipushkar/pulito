// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('./TopBar', () => ({ default: () => <div data-testid="topbar" /> }));
vi.mock('./HeaderMain', () => ({ default: (props: any) => <div data-testid="header-main" data-shrink={String(props.shrink)} /> }));
vi.mock('./CategoryNav', () => ({ default: (props: any) => <div data-testid="category-nav" data-shrink={String(props.shrink)} /> }));

import Header from './Header';

describe('Header', () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  it('renders header element', () => {
    const { container } = render(<Header categories={[]} />);
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('renders sub-components', () => {
    const { getAllByTestId } = render(<Header categories={[]} />);
    expect(getAllByTestId('topbar').length).toBeGreaterThan(0);
    expect(getAllByTestId('header-main').length).toBeGreaterThan(0);
    expect(getAllByTestId('category-nav').length).toBeGreaterThan(0);
  });

  it('sets scrolled=true when scrollY > 80', () => {
    const { getByTestId, container } = render(<Header categories={[]} />);

    // Initially not scrolled - TopBar visible
    const topBarWrapper = container.querySelector('[class*="max-h-20"]');
    expect(topBarWrapper).toBeInTheDocument();

    // Scroll past 80px
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
    act(() => {
      fireEvent.scroll(window);
    });

    // Now shrink should be true on children
    expect(getByTestId('header-main')).toHaveAttribute('data-shrink', 'true');
    expect(getByTestId('category-nav')).toHaveAttribute('data-shrink', 'true');
    // TopBar should be hidden
    expect(container.querySelector('[class*="max-h-0"]')).toBeInTheDocument();
  });

  it('sets scrolled=false when scrollY < 20 after scrolling', () => {
    const { getByTestId } = render(<Header categories={[]} />);

    // Scroll past 80px first
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
    act(() => {
      fireEvent.scroll(window);
    });
    expect(getByTestId('header-main')).toHaveAttribute('data-shrink', 'true');

    // Scroll back to < 20px
    Object.defineProperty(window, 'scrollY', { value: 10, writable: true });
    act(() => {
      fireEvent.scroll(window);
    });
    expect(getByTestId('header-main')).toHaveAttribute('data-shrink', 'false');
  });

  it('does not change scrolled in hysteresis zone', () => {
    const { getByTestId } = render(<Header categories={[]} />);

    // Scroll to 50 (between 20 and 80) - should stay false
    Object.defineProperty(window, 'scrollY', { value: 50, writable: true });
    act(() => {
      fireEvent.scroll(window);
    });
    expect(getByTestId('header-main')).toHaveAttribute('data-shrink', 'false');

    // Scroll past 80
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
    act(() => {
      fireEvent.scroll(window);
    });
    expect(getByTestId('header-main')).toHaveAttribute('data-shrink', 'true');

    // Scroll to 50 (between 20 and 80) - should stay true
    Object.defineProperty(window, 'scrollY', { value: 50, writable: true });
    act(() => {
      fireEvent.scroll(window);
    });
    expect(getByTestId('header-main')).toHaveAttribute('data-shrink', 'true');
  });

  it('removes scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Header categories={[]} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });
});
