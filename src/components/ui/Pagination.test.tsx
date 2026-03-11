// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

import Pagination from './Pagination';

describe('Pagination', () => {
  it('returns null when totalPages <= 1', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} baseUrl="/catalog" />);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders page links', () => {
    render(<Pagination currentPage={2} totalPages={5} baseUrl="/catalog" />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });










  it('renders ellipsis for many pages', () => {
    render(<Pagination currentPage={5} totalPages={20} baseUrl="/catalog" />);
    const dots = screen.getAllByText('...');
    expect(dots.length).toBeGreaterThan(0);
  });





  it('does not render rel=prev on first page', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={5} baseUrl="/catalog" />);
    expect(container.querySelector('link[rel="prev"]')).toBeNull();
  });

  it('does not render rel=next on last page', () => {
    const { container } = render(<Pagination currentPage={5} totalPages={5} baseUrl="/catalog" />);
    expect(container.querySelector('link[rel="next"]')).toBeNull();
  });


});
