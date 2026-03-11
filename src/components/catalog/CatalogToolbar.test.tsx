// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockPush = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));
vi.mock('@/components/ui/Select', () => ({
  default: ({ options, ...props }: any) => (
    <select {...props}>
      {options?.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock('@/components/icons', () => ({ Filter: () => <span>filter-icon</span> }));

import CatalogToolbar from './CatalogToolbar';

describe('CatalogToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key);
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('renders total count', () => {
    const { container } = render(<CatalogToolbar total={42} />);
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('товарів');
  });

  it('renders sort select with default value popular', () => {
    const { container } = render(<CatalogToolbar total={0} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('popular');
  });

  it('uses sort value from searchParams', () => {
    mockSearchParams.set('sort', 'price_asc');
    const { container } = render(<CatalogToolbar total={0} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('price_asc');
  });

  it('handles sort change and navigates', () => {
    mockSearchParams.set('category', 'soap');
    mockSearchParams.set('page', '3');
    const { container } = render(<CatalogToolbar total={10} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'price_desc' } });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = mockPush.mock.calls[0][0] as string;
    expect(url).toContain('sort=price_desc');
    expect(url).toContain('category=soap');
    // page should be deleted on sort change
    expect(url).not.toContain('page=');
  });

  it('renders filter button and calls onOpenFilters', () => {
    const onOpenFilters = vi.fn();
    const { container } = render(<CatalogToolbar total={0} onOpenFilters={onOpenFilters} />);
    const filterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Фільтри'),
    )!;
    expect(filterBtn).toBeInTheDocument();
    fireEvent.click(filterBtn);
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });

  it('shows active filter count in button text', () => {
    mockSearchParams.set('category', 'soap');
    mockSearchParams.set('price_min', '100');
    mockSearchParams.set('promo', 'true');
    const { container } = render(<CatalogToolbar total={5} />);
    const filterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Фільтри'),
    )!;
    expect(filterBtn.textContent).toContain('(3)');
  });

  it('does not show filter count when no filters active', () => {
    const { container } = render(<CatalogToolbar total={5} />);
    const filterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Фільтри'),
    )!;
    expect(filterBtn.textContent).not.toContain('(');
  });

  it('renders filter icon', () => {
    const { container } = render(<CatalogToolbar total={0} />);
    expect(container.textContent).toContain('filter-icon');
  });
});
