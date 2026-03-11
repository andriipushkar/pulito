// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockOnOpenFilters = vi.hoisted(() => vi.fn());
const mockOnClose = vi.hoisted(() => vi.fn());

vi.mock('@/components/catalog/CatalogToolbar', () => ({
  default: ({ total, onOpenFilters }: any) => (
    <div data-testid="catalog-toolbar" data-total={total}>
      <button data-testid="open-filters" onClick={onOpenFilters}>Open Filters</button>
    </div>
  ),
}));
vi.mock('@/components/catalog/FilterSidebar', () => ({
  default: ({ categories }: any) => <div data-testid="filter-sidebar" data-count={categories.length} />,
}));
vi.mock('@/components/catalog/MobileFilterSheet', () => ({
  default: ({ isOpen, onClose, categories }: any) => (
    <div data-testid="mobile-filter-sheet" data-open={isOpen} data-count={categories.length}>
      <button data-testid="close-filter" onClick={onClose}>Close</button>
    </div>
  ),
}));

import CatalogClient from './CatalogClient';

const categories = [
  { id: 1, name: 'Cat1', slug: 'cat1', iconPath: null, coverImage: null, description: null, sortOrder: 0, isVisible: true, parentId: null, _count: { products: 5 } },
];

describe('CatalogClient', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders CatalogToolbar with total', () => {
    const { getByTestId } = render(
      <CatalogClient total={42} categories={categories}>
        <div>children</div>
      </CatalogClient>
    );
    expect(getByTestId('catalog-toolbar')).toHaveAttribute('data-total', '42');
  });

  it('renders FilterSidebar with categories', () => {
    const { getByTestId } = render(
      <CatalogClient total={10} categories={categories}>
        <div>children</div>
      </CatalogClient>
    );
    expect(getByTestId('filter-sidebar')).toHaveAttribute('data-count', '1');
  });

  it('renders children', () => {
    const { getByText } = render(
      <CatalogClient total={10} categories={categories}>
        <div>My products list</div>
      </CatalogClient>
    );
    expect(getByText('My products list')).toBeInTheDocument();
  });

  it('opens MobileFilterSheet when onOpenFilters is called', () => {
    const { getByTestId } = render(
      <CatalogClient total={10} categories={categories}>
        <div>children</div>
      </CatalogClient>
    );
    expect(getByTestId('mobile-filter-sheet')).toHaveAttribute('data-open', 'false');
    fireEvent.click(getByTestId('open-filters'));
    expect(getByTestId('mobile-filter-sheet')).toHaveAttribute('data-open', 'true');
  });

  it('closes MobileFilterSheet when onClose is called', () => {
    const { getByTestId } = render(
      <CatalogClient total={10} categories={categories}>
        <div>children</div>
      </CatalogClient>
    );
    fireEvent.click(getByTestId('open-filters'));
    expect(getByTestId('mobile-filter-sheet')).toHaveAttribute('data-open', 'true');
    fireEvent.click(getByTestId('close-filter'));
    expect(getByTestId('mobile-filter-sheet')).toHaveAttribute('data-open', 'false');
  });

  it('passes categories to MobileFilterSheet', () => {
    const { getByTestId } = render(
      <CatalogClient total={10} categories={categories}>
        <div>children</div>
      </CatalogClient>
    );
    expect(getByTestId('mobile-filter-sheet')).toHaveAttribute('data-count', '1');
  });
});
