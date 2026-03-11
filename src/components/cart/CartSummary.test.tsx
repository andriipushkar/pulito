// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/Button', () => ({ default: ({ children, ...props }: any) => <button {...props}>{children}</button> }));

import CartSummary from './CartSummary';

describe('CartSummary', () => {
  it('renders without crashing', () => {
    const { container } = render(<CartSummary itemCount={3} total={450.5} />);
    expect(container).toBeTruthy();
  });

  it('renders item count', () => {
    render(<CartSummary itemCount={5} total={100} />);
    expect(screen.getByText(/Товарів: 5/)).toBeInTheDocument();
  });

  it('renders total with 2 decimals', () => {
    render(<CartSummary itemCount={1} total={1234.5} />);
    expect(screen.getAllByText('1234.50 ₴').length).toBeGreaterThanOrEqual(1);
  });



  it('does not render disabled reason when not provided', () => {
    render(<CartSummary itemCount={1} total={100} />);
    expect(screen.queryByText(/Мінімальне замовлення/)).not.toBeInTheDocument();
  });

  it('renders disabled reason when provided', () => {
    render(<CartSummary itemCount={1} total={100} disabledReason="Мінімальне замовлення 200 ₴" />);
    expect(screen.getByText('Мінімальне замовлення 200 ₴')).toBeInTheDocument();
  });




});
