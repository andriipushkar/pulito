// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders description and action', () => {
    render(<EmptyState title="Empty" description="Nothing here" actionLabel="Go" actionHref="/home" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Go')).toHaveAttribute('href', '/home');
  });

  it('renders icon when provided', () => {
    render(<EmptyState title="No items" icon={<span data-testid="custom-icon">icon</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('does not render icon container when icon is not provided', () => {
    const { container } = render(<EmptyState title="No items" />);
    expect(container.querySelector('.mb-4')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Empty" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('does not render action link when only actionLabel provided (no href)', () => {
    const { container } = render(<EmptyState title="Empty" actionLabel="Click" />);
    expect(container.querySelector('a')).not.toBeInTheDocument();
  });
});
