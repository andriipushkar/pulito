// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('@/components/ui/Skeleton', () => ({
  default: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

import ProductCarouselSkeleton from './ProductCarouselSkeleton';

describe('ProductCarouselSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProductCarouselSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 5 product skeleton cards', () => {
    const { container } = render(<ProductCarouselSkeleton />);
    // Each card has an aspect-square skeleton
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    // Header skeleton (1) + 5 cards * 5 skeletons each = 26
    expect(skeletons.length).toBe(26);
  });

  it('renders a title skeleton', () => {
    const { container } = render(<ProductCarouselSkeleton />);
    const firstSkeleton = container.querySelector('[data-testid="skeleton"]');
    expect(firstSkeleton).toBeInTheDocument();
  });

  it('renders a grid layout', () => {
    const { container } = render(<ProductCarouselSkeleton />);
    const grid = container.querySelector('[class*="grid"]');
    expect(grid).toBeInTheDocument();
  });
});
