// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Spinner from './Spinner';

describe('Spinner', () => {
  it('renders with status role', () => {
    render(<Spinner />);
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
  });

  it('renders sr-only text', () => {
    render(<Spinner />);
    expect(screen.getAllByText('Завантаження...').length).toBeGreaterThanOrEqual(1);
  });
});
