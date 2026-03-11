// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PriceDisplay from './PriceDisplay';

describe('PriceDisplay', () => {
  it('renders retail price formatted with 2 decimals', () => {
    const { container } = render(<PriceDisplay priceRetail={100} />);
    expect(within(container).getAllByText('100.00 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('renders retail price from string', () => {
    const { container } = render(<PriceDisplay priceRetail="250.50" />);
    expect(within(container).getAllByText('250.50 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('shows wholesale price when provided', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    expect(within(container).getAllByText('80.00 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Опт" label with wholesale price', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    expect(within(container).getAllByText('Опт').length).toBeGreaterThanOrEqual(1);
  });

  it('shows savings message when retail > wholesale', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    expect(within(container).getAllByText(/Економія 20 ₴/).length).toBeGreaterThanOrEqual(1);
  });

  it('does not show savings message when retail <= wholesale', () => {
    const { container } = render(<PriceDisplay priceRetail={80} priceWholesale={80} />);
    expect(within(container).queryAllByText(/Економія/).length).toBe(0);
  });

  it('does not show wholesale section when null', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={null} />);
    expect(within(container).queryAllByText('Опт').length).toBe(0);
  });

  it('does not show wholesale section when undefined', () => {
    const { container } = render(<PriceDisplay priceRetail={100} />);
    expect(within(container).queryAllByText('Опт').length).toBe(0);
  });

  it('shows old price with line-through when discount exists', () => {
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld={100} />);
    const oldPrices = within(container).getAllByText('100.00 ₴');
    expect(oldPrices.length).toBeGreaterThanOrEqual(1);
    expect(oldPrices.some(el => el.classList.contains('line-through'))).toBe(true);
  });

  it('shows discount percentage badge', () => {
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld={100} />);
    expect(within(container).getAllByText('-20%').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show discount when old price is null', () => {
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld={null} />);
    expect(within(container).queryAllByText(/-\d+%/).length).toBe(0);
  });

  it('does not show discount when old price equals retail', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceRetailOld={100} />);
    expect(within(container).queryAllByText(/-\d+%/).length).toBe(0);
  });

  it('does not show discount when old price less than retail', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceRetailOld={80} />);
    expect(within(container).queryAllByText(/-\d+%/).length).toBe(0);
  });

  it('applies sm size classes', () => {
    const { container } = render(<PriceDisplay priceRetail={100} size="sm" />);
    expect(container.querySelector('.text-sm')).toBeInTheDocument();
  });

  it('applies md size classes by default', () => {
    const { container } = render(<PriceDisplay priceRetail={100} />);
    expect(container.querySelector('.text-lg')).toBeInTheDocument();
  });

  it('applies lg size classes', () => {
    const { container } = render(<PriceDisplay priceRetail={100} size="lg" />);
    expect(container.querySelector('.text-2xl')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PriceDisplay priceRetail={100} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies discount color when discount exists', () => {
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld={100} />);
    const priceSpan = container.querySelector('[class*="color-discount"]');
    expect(priceSpan).toBeInTheDocument();
  });

  it('applies normal text color when no discount', () => {
    const { container } = render(<PriceDisplay priceRetail={80} />);
    const priceSpan = container.querySelector('[class*="color-text"]');
    expect(priceSpan).toBeInTheDocument();
  });

  it('calculates discount percentage correctly', () => {
    const { container } = render(<PriceDisplay priceRetail={75} priceRetailOld={100} />);
    expect(within(container).getAllByText('-25%').length).toBeGreaterThanOrEqual(1);
  });

  it('rounds discount percentage', () => {
    const { container } = render(<PriceDisplay priceRetail={70} priceRetailOld={100} />);
    expect(within(container).getAllByText('-30%').length).toBeGreaterThanOrEqual(1);
  });

  it('handles wholesale as string', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale="85.50" />);
    expect(within(container).getAllByText('85.50 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('handles priceRetailOld as string', () => {
    const { container } = render(<PriceDisplay priceRetail={80} priceRetailOld="100" />);
    expect(within(container).getAllByText('100.00 ₴').length).toBeGreaterThanOrEqual(1);
    expect(within(container).getAllByText('-20%').length).toBeGreaterThanOrEqual(1);
  });

  it('shows wholesale title tooltip', () => {
    const { container } = render(<PriceDisplay priceRetail={100} priceWholesale={80} />);
    const wholesaleSpan = container.querySelector('[title="Оптова ціна від 5 шт."]');
    expect(wholesaleSpan).toBeInTheDocument();
  });
});
