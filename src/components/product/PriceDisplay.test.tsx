// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PriceDisplay from './PriceDisplay';

// Mock useAuth — default: regular user (no wholesale)
const mockUser = { wholesaleGroup: null as number | null };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser.wholesaleGroup ? mockUser : null }),
}));

describe('PriceDisplay — retail user (no wholesale group)', () => {
  it('renders retail price formatted with 2 decimals', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail={100} />);
    expect(within(container).getAllByText('100.00 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('renders retail price from string', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail="250.50" />);
    expect(within(container).getAllByText('250.50 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('shows old price with line-through when discount exists', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld={100} />);
    const oldPrices = within(container).getAllByText('100.00 ₴');
    expect(oldPrices.length).toBeGreaterThanOrEqual(1);
    expect(oldPrices.some(el => el.classList.contains('line-through'))).toBe(true);
  });

  it('shows discount percentage badge', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld={100} />);
    expect(within(container).getAllByText('-20%').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show discount when old price is null', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld={null} />);
    expect(within(container).queryAllByText(/-\d+%/).length).toBe(0);
  });

  it('does not show wholesale label for regular user', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    expect(within(container).queryAllByText(/Опт/).length).toBe(0);
  });

  it('applies size classes', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail={100} size="sm" />);
    expect(container.querySelector('.text-sm')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    mockUser.wholesaleGroup = null;
    const { container } = render(<PriceDisplay priceRetail={100} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('PriceDisplay — wholesale user (group 1)', () => {
  it('shows wholesale price as main price', () => {
    mockUser.wholesaleGroup = 1;
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    expect(within(container).getAllByText('80.00 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('shows retail as crossed out', () => {
    mockUser.wholesaleGroup = 1;
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    const retailPrices = within(container).getAllByText('100.00 ₴');
    expect(retailPrices.some(el => el.classList.contains('line-through'))).toBe(true);
  });

  it('shows Опт 1 badge', () => {
    mockUser.wholesaleGroup = 1;
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    expect(within(container).getAllByText('Опт 1').length).toBeGreaterThanOrEqual(1);
  });
});

describe('PriceDisplay — wholesale user (group 2)', () => {
  it('shows priceWholesale2 for group 2 user', () => {
    mockUser.wholesaleGroup = 2;
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={90} priceWholesale2={75} priceWholesale3={60} />);
    expect(within(container).getAllByText('75.00 ₴').length).toBeGreaterThanOrEqual(1);
    expect(within(container).getAllByText('Опт 2').length).toBeGreaterThanOrEqual(1);
  });
});

describe('PriceDisplay — wholesale user (group 3)', () => {
  it('shows priceWholesale3 for group 3 user', () => {
    mockUser.wholesaleGroup = 3;
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={90} priceWholesale2={75} priceWholesale3={60} />);
    expect(within(container).getAllByText('60.00 ₴').length).toBeGreaterThanOrEqual(1);
    expect(within(container).getAllByText('Опт 3').length).toBeGreaterThanOrEqual(1);
  });
});
