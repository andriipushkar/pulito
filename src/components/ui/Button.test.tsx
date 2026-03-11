// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Button from './Button';

describe('Button', () => {
  it('renders without crash', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders with variant and size props', () => {
    render(<Button variant="danger" size="lg">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toContain('px-6');
  });

  it('shows spinner when isLoading', () => {
    render(<Button isLoading>Loading</Button>);
    const btn = screen.getByRole('button', { name: 'Loading' });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });
});
