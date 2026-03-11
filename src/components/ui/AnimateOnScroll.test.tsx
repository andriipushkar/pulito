// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/hooks/useInView', () => ({
  useInView: () => [vi.fn(), false],
}));

import AnimateOnScroll from './AnimateOnScroll';

describe('AnimateOnScroll', () => {
  it('renders children', () => {
    render(<AnimateOnScroll>Test content</AnimateOnScroll>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});
