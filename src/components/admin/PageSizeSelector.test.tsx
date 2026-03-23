// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PageSizeSelector from './PageSizeSelector';

afterEach(() => {
  cleanup();
});

describe('PageSizeSelector', () => {
  it('renders all page size options (10, 20, 50, 100)', () => {
    render(<PageSizeSelector value={20} onChange={vi.fn()} />);
    const select = screen.getByLabelText('Кількість на сторінці');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveValue('10');
    expect(options[1]).toHaveValue('20');
    expect(options[2]).toHaveValue('50');
    expect(options[3]).toHaveValue('100');
  });

  it('shows current value as selected', () => {
    render(<PageSizeSelector value={50} onChange={vi.fn()} />);
    const select = screen.getByLabelText('Кількість на сторінці') as HTMLSelectElement;
    expect(select.value).toBe('50');
  });

  it('calls onChange with numeric value when selection changes', () => {
    const onChange = vi.fn();
    render(<PageSizeSelector value={20} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Кількість на сторінці'), {
      target: { value: '100' },
    });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('renders the "Показувати:" label', () => {
    render(<PageSizeSelector value={10} onChange={vi.fn()} />);
    expect(screen.getByText('Показувати:')).toBeInTheDocument();
  });
});
