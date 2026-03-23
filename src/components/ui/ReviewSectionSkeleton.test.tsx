// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('@/components/ui/Skeleton', () => ({
  default: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

import ReviewSectionSkeleton from './ReviewSectionSkeleton';

describe('ReviewSectionSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ReviewSectionSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders multiple skeleton elements', () => {
    const { container } = render(<ReviewSectionSkeleton />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it('renders 3 review card skeletons', () => {
    const { container } = render(<ReviewSectionSkeleton />);
    const cards = container.querySelectorAll('[class*="rounded-xl"]');
    expect(cards.length).toBe(3);
  });

  it('renders circular avatar skeletons', () => {
    const { container } = render(<ReviewSectionSkeleton />);
    const roundedFull = container.querySelectorAll('[class*="rounded-full"]');
    expect(roundedFull.length).toBeGreaterThan(0);
  });
});
