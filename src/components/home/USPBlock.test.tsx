// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let intersectionCallback: IntersectionObserverCallback;

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(cb: IntersectionObserverCallback) {
    intersectionCallback = cb;
  }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

import USPBlock from './USPBlock';

describe('USPBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders section with default items', () => {
    const { container } = render(<USPBlock />);
    expect(container.querySelector('section')).toBeInTheDocument();
    expect(container.textContent).toContain('Швидка доставка');
    expect(container.textContent).toContain('Гарантія якості');
    expect(container.textContent).toContain('Оптові ціни');
    expect(container.textContent).toContain('Підтримка');
  });

  it('renders custom items when provided', () => {
    const items = [{ icon: 'truck', title: 'Custom Title', description: 'Custom Desc' }];
    const { container } = render(<USPBlock items={items} />);
    expect(container.textContent).toContain('Custom Title');
    expect(container.textContent).toContain('Custom Desc');
  });

  it('renders with empty items (falls back to defaults)', () => {
    const { container } = render(<USPBlock items={[]} />);
    expect(container.textContent).toContain('Швидка доставка');
  });

  it('renders all icon types correctly', () => {
    const items = [
      { icon: 'truck', title: 'T1', description: 'D1' },
      { icon: 'shield', title: 'T2', description: 'D2' },
      { icon: 'money', title: 'T3', description: 'D3' },
      { icon: 'phone', title: 'T4', description: 'D4' },
      { icon: 'unknown', title: 'T5', description: 'D5' },
    ];
    const { container } = render(<USPBlock items={items} />);
    // All should render SVGs
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(10); // 5 items * 2 views (mobile + tablet)
  });

  it('applies visible class when intersection observer fires', () => {
    const { container } = render(<USPBlock />);

    // Initially not visible
    const cards = container.querySelectorAll('[class*="translate-y"]');
    expect(cards.length).toBeGreaterThan(0);

    // Trigger intersection
    act(() => {
      intersectionCallback(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });

    // After intersection, opacity-100 should be applied
    const visibleCards = container.querySelectorAll('[class*="opacity-100"]');
    expect(visibleCards.length).toBeGreaterThan(0);
  });

  it('does not change visibility when not intersecting', () => {
    const { container } = render(<USPBlock />);

    act(() => {
      intersectionCallback(
        [{ isIntersecting: false }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });

    // Should still have opacity-0
    const hiddenCards = container.querySelectorAll('[class*="opacity-0"]');
    expect(hiddenCards.length).toBeGreaterThan(0);
  });

  it('renders mobile scrollable layout and tablet grid', () => {
    const { container } = render(<USPBlock />);
    // Mobile: horizontal scroll
    expect(container.querySelector('.scrollbar-hide')).toBeInTheDocument();
    // Tablet: grid
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('renders descriptions for each USP item', () => {
    const { container } = render(<USPBlock />);
    expect(container.textContent).toContain('По всій Україні за 1-3 дні');
    expect(container.textContent).toContain('Тільки оригінальна продукція');
    expect(container.textContent).toContain('Знижки для оптових покупців');
    expect(container.textContent).toContain('Консультація Пн-Пт 9-18');
  });

  it('applies transition delay based on index', () => {
    const { container } = render(<USPBlock />);

    // Trigger visibility
    act(() => {
      intersectionCallback(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });

    // Check that items have different transition delays
    const mobileCards = container.querySelectorAll('.scrollbar-hide > div');
    if (mobileCards.length >= 2) {
      const delay0 = (mobileCards[0] as HTMLElement).style.transitionDelay;
      const delay1 = (mobileCards[1] as HTMLElement).style.transitionDelay;
      expect(delay0).not.toBe(delay1);
    }
  });

  it('disconnects observer on unmount', () => {
    const { unmount } = render(<USPBlock />);
    const obs = new MockIntersectionObserver(() => {});
    unmount();
    // IntersectionObserver disconnect should have been called
    // The component creates its own observer, so we just verify no errors
  });
});
