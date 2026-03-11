// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import IconButton from './IconButton';

describe('IconButton', () => {
  it('renders with aria-label', () => {
    render(<IconButton icon={<span>X</span>} label="Close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows badge when provided', () => {
    render(<IconButton icon={<span>C</span>} label="Cart" badge={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 99+ for large badge', () => {
    render(<IconButton icon={<span>C</span>} label="Cart" badge={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
