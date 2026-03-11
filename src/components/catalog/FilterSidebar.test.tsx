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

import FilterSidebar from './FilterSidebar';
import type { CategoryListItem } from '@/types/category';

const makeCat = (overrides: Partial<CategoryListItem> = {}): CategoryListItem => ({
  id: 1,
  name: 'Cat1',
  slug: 'cat1',
  iconPath: null,
  coverImage: null,
  description: null,
  sortOrder: 0,
  isVisible: true,
  parentId: null,
  _count: { products: 10 },
  ...overrides,
});

describe('FilterSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to empty search params by default
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key);
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('renders categories section with parent categories', () => {
    const categories = [
      makeCat({ id: 1, name: 'Parent', slug: 'parent', parentId: null }),
      makeCat({ id: 2, name: 'Child', slug: 'child', parentId: 1 }),
    ];
    const { container } = render(<FilterSidebar categories={categories} />);
    expect(container.textContent).toContain('Категорії');
    expect(container.textContent).toContain('Parent');
    // Child has parentId, should not be rendered
    expect(container.textContent).not.toContain('Child');
  });

  it('renders product count for categories', () => {
    const { container } = render(<FilterSidebar categories={[makeCat({ _count: { products: 42 } })]} />);
    expect(container.textContent).toContain('42');
  });

  it('renders price section with sliders and inputs', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    expect(container.textContent).toContain('Ціна, ₴');
    const rangeInputs = container.querySelectorAll('input[type="range"]');
    expect(rangeInputs).toHaveLength(2);
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs).toHaveLength(2);
  });

  it('renders promo and inStock checkboxes', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    expect(container.textContent).toContain('Тільки акційні');
    expect(container.textContent).toContain('В наявності');
  });

  it('renders apply and reset buttons', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    expect(container.textContent).toContain('Застосувати');
    expect(container.textContent).toContain('Скинути');
  });

  it('toggles category checkbox on click', () => {
    const categories = [makeCat()];
    const { container } = render(<FilterSidebar categories={categories} />);
    const checkbox = container.querySelector('input[type="checkbox"][value="cat1"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    // Toggle off
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('handles min price slider change', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const rangeInputs = container.querySelectorAll('input[type="range"]');
    const minSlider = rangeInputs[0] as HTMLInputElement;
    fireEvent.change(minSlider, { target: { value: '500' } });
    // The number input should reflect the change
    const numberInputs = container.querySelectorAll('input[type="number"]');
    const minInput = numberInputs[0] as HTMLInputElement;
    expect(minInput.value).toBe('500');
  });

  it('handles max price slider change', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const rangeInputs = container.querySelectorAll('input[type="range"]');
    const maxSlider = rangeInputs[1] as HTMLInputElement;
    fireEvent.change(maxSlider, { target: { value: '8000' } });
    const numberInputs = container.querySelectorAll('input[type="number"]');
    const maxInput = numberInputs[1] as HTMLInputElement;
    expect(maxInput.value).toBe('8000');
  });

  it('clamps min slider to not exceed max', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const rangeInputs = container.querySelectorAll('input[type="range"]');
    // Default max is 10000, set min to something higher - it should be clamped
    fireEvent.change(rangeInputs[0], { target: { value: '15000' } });
    const numberInputs = container.querySelectorAll('input[type="number"]');
    // Since sliderMax defaults to 10000, min should be clamped to 10000
    expect((numberInputs[0] as HTMLInputElement).value).toBe('10000');
  });

  it('clamps max slider to not go below min', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const rangeInputs = container.querySelectorAll('input[type="range"]');
    // First set min to 3000
    fireEvent.change(rangeInputs[0], { target: { value: '3000' } });
    // Then set max to 1000 - should be clamped to 3000
    fireEvent.change(rangeInputs[1], { target: { value: '1000' } });
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect((numberInputs[1] as HTMLInputElement).value).toBe('3000');
  });

  it('handleSliderMin resets to empty string when value equals PRICE_MIN_DEFAULT', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const rangeInputs = container.querySelectorAll('input[type="range"]');
    // Set to non-zero first
    fireEvent.change(rangeInputs[0], { target: { value: '500' } });
    // Set back to 0 (PRICE_MIN_DEFAULT)
    fireEvent.change(rangeInputs[0], { target: { value: '0' } });
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect((numberInputs[0] as HTMLInputElement).value).toBe('');
  });

  it('handleSliderMax resets to empty string when value equals PRICE_MAX_DEFAULT', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const rangeInputs = container.querySelectorAll('input[type="range"]');
    // Set max to non-default
    fireEvent.change(rangeInputs[1], { target: { value: '5000' } });
    // Set back to 10000 (PRICE_MAX_DEFAULT)
    fireEvent.change(rangeInputs[1], { target: { value: '10000' } });
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect((numberInputs[1] as HTMLInputElement).value).toBe('');
  });

  it('handles manual number input for priceMin', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[0], { target: { value: '200' } });
    expect((numberInputs[0] as HTMLInputElement).value).toBe('200');
  });

  it('handles manual number input for priceMax', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[1], { target: { value: '9000' } });
    expect((numberInputs[1] as HTMLInputElement).value).toBe('9000');
  });

  it('toggles promo checkbox', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // promo is the first non-category checkbox
    const promoCheckbox = checkboxes[0] as HTMLInputElement;
    expect(promoCheckbox.checked).toBe(false);
    fireEvent.click(promoCheckbox);
    expect(promoCheckbox.checked).toBe(true);
  });

  it('toggles inStock checkbox', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const inStockCheckbox = checkboxes[1] as HTMLInputElement;
    expect(inStockCheckbox.checked).toBe(false);
    fireEvent.click(inStockCheckbox);
    expect(inStockCheckbox.checked).toBe(true);
  });

  it('applyFilters navigates with all set params', () => {
    const categories = [makeCat()];
    const { container } = render(<FilterSidebar categories={categories} />);

    // Select a category
    const catCheckbox = container.querySelector('input[type="checkbox"][value="cat1"]') as HTMLInputElement;
    fireEvent.click(catCheckbox);

    // Set price range
    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[0], { target: { value: '100' } });
    fireEvent.change(numberInputs[1], { target: { value: '5000' } });

    // Check promo and inStock
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([value])');
    fireEvent.click(checkboxes[0]); // promo
    fireEvent.click(checkboxes[1]); // inStock

    // Click apply
    const buttons = container.querySelectorAll('button');
    const applyBtn = Array.from(buttons).find((b) => b.textContent === 'Застосувати')!;
    fireEvent.click(applyBtn);

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = mockPush.mock.calls[0][0] as string;
    expect(url).toContain('/catalog?');
    expect(url).toContain('category=cat1');
    expect(url).toContain('price_min=100');
    expect(url).toContain('price_max=5000');
    expect(url).toContain('promo=true');
    expect(url).toContain('in_stock=true');
  });

  it('applyFilters preserves search and sort from searchParams', () => {
    mockSearchParams.set('search', 'порошок');
    mockSearchParams.set('sort', 'price_asc');

    const { container } = render(<FilterSidebar categories={[]} />);
    const applyBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Застосувати',
    )!;
    fireEvent.click(applyBtn);

    const url = mockPush.mock.calls[0][0] as string;
    expect(url).toContain('search=');
    expect(url).toContain('sort=price_asc');
  });

  it('applyFilters omits empty params', () => {
    const { container } = render(<FilterSidebar categories={[]} />);
    const applyBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Застосувати',
    )!;
    fireEvent.click(applyBtn);

    const url = mockPush.mock.calls[0][0] as string;
    expect(url).not.toContain('category');
    expect(url).not.toContain('price_min');
    expect(url).not.toContain('price_max');
    expect(url).not.toContain('promo');
    expect(url).not.toContain('in_stock');
  });

  it('resetFilters clears all and navigates to /catalog', () => {
    const categories = [makeCat()];
    const { container } = render(<FilterSidebar categories={categories} />);

    // Set some filters first
    const catCheckbox = container.querySelector('input[type="checkbox"][value="cat1"]') as HTMLInputElement;
    fireEvent.click(catCheckbox);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([value])');
    fireEvent.click(checkboxes[0]); // promo

    // Click reset
    const resetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Скинути',
    )!;
    fireEvent.click(resetBtn);

    expect(mockPush).toHaveBeenCalledWith('/catalog');
    // Verify state is reset
    expect(catCheckbox.checked).toBe(false);
  });

  it('initializes state from searchParams', () => {
    mockSearchParams.set('category', 'cat1');
    mockSearchParams.set('price_min', '100');
    mockSearchParams.set('price_max', '5000');
    mockSearchParams.set('promo', 'true');
    mockSearchParams.set('in_stock', 'true');

    const categories = [makeCat()];
    const { container } = render(<FilterSidebar categories={categories} />);

    const catCheckbox = container.querySelector('input[type="checkbox"][value="cat1"]') as HTMLInputElement;
    expect(catCheckbox.checked).toBe(true);

    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect((numberInputs[0] as HTMLInputElement).value).toBe('100');
    expect((numberInputs[1] as HTMLInputElement).value).toBe('5000');

    const otherCheckboxes = container.querySelectorAll('input[type="checkbox"]:not([value])');
    expect((otherCheckboxes[0] as HTMLInputElement).checked).toBe(true); // promo
    expect((otherCheckboxes[1] as HTMLInputElement).checked).toBe(true); // inStock
  });
});
