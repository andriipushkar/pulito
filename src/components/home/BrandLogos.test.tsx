// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

const mockPause = vi.fn();
const mockPlay = vi.fn();
const mockCancel = vi.fn();

beforeEach(() => {
  Element.prototype.animate = vi.fn().mockReturnValue({
    pause: mockPause,
    play: mockPlay,
    cancel: mockCancel,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

import BrandLogos from './BrandLogos';

describe('BrandLogos', () => {
  it('renders section with brand names', () => {
    const { container } = render(<BrandLogos />);
    expect(container.querySelector('section')).toBeInTheDocument();
    expect(container.textContent).toContain('Frosch');
    expect(container.textContent).toContain('Fairy');
  });

  it('renders heading', () => {
    const { container } = render(<BrandLogos />);
    expect(container.textContent).toContain('Наші бренди');
  });

  it('renders all 12 brands (duplicated for infinite scroll)', () => {
    const { container } = render(<BrandLogos />);
    const links = container.querySelectorAll('a[href*="/catalog?brand="]');
    // 12 brands * 2 (duplicated) = 24
    expect(links.length).toBe(24);
  });

  it('renders links with correct brand slugs', () => {
    const { container } = render(<BrandLogos />);
    expect(container.querySelector('a[href="/catalog?brand=frosch"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/catalog?brand=fairy"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/catalog?brand=persil"]')).toBeInTheDocument();
  });

  it('starts animation on mount', () => {
    render(<BrandLogos />);
    expect(Element.prototype.animate).toHaveBeenCalledWith(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }],
      { duration: 30000, iterations: Infinity, easing: 'linear' },
    );
  });

  it('pauses animation on mouseenter and plays on mouseleave', () => {
    const { container } = render(<BrandLogos />);
    const scrollContainer = container.querySelector('.overflow-hidden.rounded-2xl') as HTMLElement;

    fireEvent.mouseEnter(scrollContainer);
    expect(mockPause).toHaveBeenCalled();

    fireEvent.mouseLeave(scrollContainer);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('cancels animation on unmount', () => {
    const { unmount } = render(<BrandLogos />);
    unmount();
    expect(mockCancel).toHaveBeenCalled();
  });

  it('renders BrandIcon SVGs with correct initials', () => {
    const { container } = render(<BrandLogos />);
    const texts = container.querySelectorAll('text');
    // Each brand has an icon with initials, duplicated = 24 total
    expect(texts.length).toBe(24);
    // Check first brand "Frosch" -> "F"
    expect(texts[0].textContent).toBe('F');
  });

  it('renders multi-word brand initials correctly (Mr. Proper -> MP)', () => {
    const { container } = render(<BrandLogos />);
    const texts = Array.from(container.querySelectorAll('text'));
    const mpTexts = texts.filter(t => t.textContent === 'MP');
    // Mr. Proper appears twice (original + duplicate)
    expect(mpTexts.length).toBe(2);
  });
});
