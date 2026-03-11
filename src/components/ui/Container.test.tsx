// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Container from './Container';

describe('Container', () => {
  it('renders children', () => {
    render(<Container>Hello</Container>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies max-width class', () => {
    const { container } = render(<Container>Test</Container>);
    expect(container.firstChild).toHaveClass('max-w-[1440px]');
  });
});
