// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} />,
}));
vi.mock('@/components/ui/Badge', () => ({
  default: ({ children, className }: any) => <span data-testid="badge" className={className}>{children}</span>,
}));

import BundleCard from './BundleCard';

const makeBundle = (overrides: any = {}) => ({
  id: 1,
  name: 'Cleaning Bundle',
  slug: 'cleaning-bundle',
  description: 'A great cleaning bundle',
  imagePath: '/images/bundle.jpg',
  items: [{ id: 1 }, { id: 2 }, { id: 3 }],
  pricing: {
    originalPrice: 500,
    finalPrice: 400,
    savings: 100,
  },
  ...overrides,
});

describe('BundleCard', () => {
  it('renders bundle name', () => {
    render(<BundleCard bundle={makeBundle()} />);
    expect(screen.getByText('Cleaning Bundle')).toBeInTheDocument();
  });

  it('renders bundle description', () => {
    render(<BundleCard bundle={makeBundle()} />);
    expect(screen.getByText('A great cleaning bundle')).toBeInTheDocument();
  });

  it('does not render description when null', () => {
    render(<BundleCard bundle={makeBundle({ description: null })} />);
    expect(screen.queryByText('A great cleaning bundle')).not.toBeInTheDocument();
  });

  it('renders final price', () => {
    render(<BundleCard bundle={makeBundle()} />);
    expect(screen.getByText('400.00 ₴')).toBeInTheDocument();
  });

  it('renders original price with line-through when discounted', () => {
    render(<BundleCard bundle={makeBundle()} />);
    expect(screen.getByText('500.00 ₴')).toBeInTheDocument();
  });

  it('does not show original price when no discount', () => {
    const bundle = makeBundle({
      pricing: { originalPrice: 400, finalPrice: 400, savings: 0 },
    });
    render(<BundleCard bundle={bundle} />);
    const prices = screen.getAllByText('400.00 ₴');
    expect(prices).toHaveLength(1);
  });

  it('renders item count badge', () => {
    render(<BundleCard bundle={makeBundle()} />);
    expect(screen.getByText('3 товари')).toBeInTheDocument();
  });

  it('renders discount percentage badge', () => {
    render(<BundleCard bundle={makeBundle()} />);
    expect(screen.getByText('-20%')).toBeInTheDocument();
  });

  it('links to the correct bundle page', () => {
    render(<BundleCard bundle={makeBundle()} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/bundles/cleaning-bundle');
  });

  it('renders image when imagePath is provided', () => {
    render(<BundleCard bundle={makeBundle()} />);
    expect(screen.getByAltText('Cleaning Bundle')).toBeInTheDocument();
  });

  it('renders placeholder when no imagePath', () => {
    render(<BundleCard bundle={makeBundle({ imagePath: null })} />);
    expect(screen.queryByAltText('Cleaning Bundle')).not.toBeInTheDocument();
  });

  it('shows singular item count for 1 item', () => {
    render(<BundleCard bundle={makeBundle({ items: [{ id: 1 }] })} />);
    expect(screen.getByText('1 товар')).toBeInTheDocument();
  });

  it('shows plural item count for 5+ items', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: i }));
    render(<BundleCard bundle={makeBundle({ items })} />);
    expect(screen.getByText('7 товарів')).toBeInTheDocument();
  });
});
