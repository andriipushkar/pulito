// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import BackToTop from './BackToTop';

describe('BackToTop', () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('renders button with aria-label', () => {
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });
    expect(button).toBeInTheDocument();
  });

  it('is hidden initially', () => {
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });
    expect(button.className).toContain('opacity-0');
  });

  it('becomes visible when scrolled down 400+ and scrolling up', () => {
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });

    Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(button.className).toContain('opacity-0');

    Object.defineProperty(window, 'scrollY', { value: 480, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(button.className).toContain('opacity-100');
  });

  it('hides when scrolled back to top', () => {
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });

    Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });

    Object.defineProperty(window, 'scrollY', { value: 480, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(button.className).toContain('opacity-100');

    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });
    expect(button.className).toContain('opacity-0');
  });

  it('calls scrollTo on click', () => {
    window.scrollTo = vi.fn() as any;
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });
    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('stays hidden when scrolling down', () => {
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });

    Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });

    Object.defineProperty(window, 'scrollY', { value: 600, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });

    expect(button.className).toContain('opacity-0');
  });

  it('renders SVG arrow icon', () => {
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('sets scrollDirection to up when scrolling up but below 400px threshold', () => {
    render(<BackToTop />);
    const button = screen.getByRole('button', { name: /нагору/i });

    // Scroll down first to set direction = down
    Object.defineProperty(window, 'scrollY', { value: 300, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });

    // Now scroll up but stay under 400
    Object.defineProperty(window, 'scrollY', { value: 280, writable: true, configurable: true });
    act(() => { fireEvent.scroll(window); });

    // Should remain hidden because currentY < 400
    expect(button.className).toContain('opacity-0');
  });
});
