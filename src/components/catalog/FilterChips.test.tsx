// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import FilterChips from './FilterChips';

const filters = [
  { key: 'category', label: 'Категорія', value: 'Порошки' },
  { key: 'brand', label: 'Бренд', value: 'Tide' },
  { key: 'price', label: 'Ціна', value: '100-500 ₴' },
];

describe('FilterChips', () => {
  const onRemove = vi.fn();
  const onClearAll = vi.fn();

  it('renders nothing when filters array is empty', () => {
    const { container } = render(
      <FilterChips filters={[]} onRemove={onRemove} onClearAll={onClearAll} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders all filter chips', () => {
    render(<FilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);
    expect(screen.getByText('Порошки')).toBeInTheDocument();
    expect(screen.getByText('Tide')).toBeInTheDocument();
    expect(screen.getByText('100-500 ₴')).toBeInTheDocument();
  });

  it('renders filter labels', () => {
    render(<FilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);
    expect(screen.getByText('Категорія:')).toBeInTheDocument();
    expect(screen.getByText('Бренд:')).toBeInTheDocument();
  });

  it('calls onRemove with correct key when chip remove button is clicked', () => {
    onRemove.mockClear();
    render(<FilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);
    const removeBtn = screen.getByLabelText('Видалити фільтр Бренд');
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith('brand');
  });

  it('renders "Очистити все" button', () => {
    render(<FilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);
    expect(screen.getByText('Очистити все')).toBeInTheDocument();
  });

  it('calls onClearAll when "Очистити все" is clicked', () => {
    onClearAll.mockClear();
    render(<FilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByText('Очистити все'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('renders remove buttons with correct aria-labels', () => {
    render(<FilterChips filters={filters} onRemove={onRemove} onClearAll={onClearAll} />);
    expect(screen.getByLabelText('Видалити фільтр Категорія')).toBeInTheDocument();
    expect(screen.getByLabelText('Видалити фільтр Бренд')).toBeInTheDocument();
    expect(screen.getByLabelText('Видалити фільтр Ціна')).toBeInTheDocument();
  });
});
