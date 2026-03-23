// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import BundlePriceSummary from './BundlePriceSummary';

describe('BundlePriceSummary', () => {
  it('renders the heading', () => {
    render(<BundlePriceSummary originalPrice={500} finalPrice={400} savings={100} />);
    expect(screen.getByText('Підсумок цін')).toBeInTheDocument();
  });

  it('renders original price', () => {
    render(<BundlePriceSummary originalPrice={500} finalPrice={400} savings={100} />);
    expect(screen.getByText('500.00 ₴')).toBeInTheDocument();
  });

  it('renders final price', () => {
    render(<BundlePriceSummary originalPrice={500} finalPrice={400} savings={100} />);
    expect(screen.getByText('400.00 ₴')).toBeInTheDocument();
  });

  it('renders discount percentage and savings', () => {
    render(<BundlePriceSummary originalPrice={500} finalPrice={400} savings={100} />);
    expect(screen.getByText('-20% (100.00 ₴)')).toBeInTheDocument();
  });

  it('renders "Знижка комплекту" label when there is a discount', () => {
    render(<BundlePriceSummary originalPrice={500} finalPrice={400} savings={100} />);
    expect(screen.getByText('Знижка комплекту')).toBeInTheDocument();
  });

  it('does not render discount info when savings is 0', () => {
    render(<BundlePriceSummary originalPrice={300} finalPrice={300} savings={0} />);
    expect(screen.queryByText('Знижка комплекту')).not.toBeInTheDocument();
  });

  it('renders "Ціна комплекту" label', () => {
    render(<BundlePriceSummary originalPrice={300} finalPrice={300} savings={0} />);
    expect(screen.getByText('Ціна комплекту')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <BundlePriceSummary originalPrice={100} finalPrice={80} savings={20} className="mt-4" />
    );
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('handles zero original price without crashing', () => {
    render(<BundlePriceSummary originalPrice={0} finalPrice={0} savings={0} />);
    expect(screen.getByText('Ціна комплекту')).toBeInTheDocument();
  });
});
