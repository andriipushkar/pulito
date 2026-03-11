// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ProductCardSkeleton from './ProductCardSkeleton';

describe('ProductCardSkeleton', () => {
  it('renders without crash', () => {
    const { container } = render(<ProductCardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
