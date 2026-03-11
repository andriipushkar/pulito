// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/icons', () => ({
  Minus: () => <span data-testid="minus-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
}));

import QuantitySelector from './QuantitySelector';

function getElements(container: HTMLElement) {
  const decBtn = container.querySelector('button[aria-label="Зменшити"]') as HTMLButtonElement;
  const incBtn = container.querySelector('button[aria-label="Збільшити"]') as HTMLButtonElement;
  const input = container.querySelector('input[type="number"]') as HTMLInputElement;
  return { decBtn, incBtn, input };
}

describe('QuantitySelector', () => {
  it('renders current value', () => {
    const { container } = render(<QuantitySelector value={5} onChange={vi.fn()} />);
    const { input } = getElements(container);
    expect(input.value).toBe('5');
  });

  it('renders increment and decrement buttons', () => {
    const { container } = render(<QuantitySelector value={3} onChange={vi.fn()} />);
    const { decBtn, incBtn } = getElements(container);
    expect(decBtn).toBeInTheDocument();
    expect(incBtn).toBeInTheDocument();
  });

  it('calls onChange with incremented value when + clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={3} onChange={onChange} />);
    const { incBtn } = getElements(container);
    fireEvent.click(incBtn);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('calls onChange with decremented value when - clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={3} onChange={onChange} />);
    const { decBtn } = getElements(container);
    fireEvent.click(decBtn);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('disables decrement button at min value', () => {
    const { container } = render(<QuantitySelector value={1} onChange={vi.fn()} min={1} />);
    const { decBtn } = getElements(container);
    expect(decBtn).toBeDisabled();
  });

  it('disables increment button at max value', () => {
    const { container } = render(<QuantitySelector value={10} onChange={vi.fn()} max={10} />);
    const { incBtn } = getElements(container);
    expect(incBtn).toBeDisabled();
  });

  it('does not call onChange when clicking disabled decrement at min', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={1} onChange={onChange} min={1} />);
    const { decBtn } = getElements(container);
    expect(decBtn).toBeDisabled();
    fireEvent.click(decBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when clicking disabled increment at max', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={5} onChange={onChange} max={5} />);
    const { incBtn } = getElements(container);
    expect(incBtn).toBeDisabled();
    fireEvent.click(incBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps input value to min via handleChange', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={3} onChange={onChange} min={2} />);
    const { input } = getElements(container);
    fireEvent.change(input, { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('handles input change event', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={3} onChange={onChange} />);
    const { input } = getElements(container);
    fireEvent.change(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('handles non-numeric input by falling back to min', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={3} onChange={onChange} min={1} />);
    const { input } = getElements(container);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('clamps input value to max', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={3} onChange={onChange} max={10} />);
    const { input } = getElements(container);
    fireEvent.change(input, { target: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('applies custom className', () => {
    const { container } = render(
      <QuantitySelector value={1} onChange={vi.fn()} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('uses default min=1 and max=999', () => {
    const onChange = vi.fn();
    const { container } = render(<QuantitySelector value={500} onChange={onChange} />);
    const { input } = getElements(container);
    fireEvent.change(input, { target: { value: '1000' } });
    expect(onChange).toHaveBeenCalledWith(999);
  });

  it('renders minus and plus icons', () => {
    const { getAllByTestId } = render(<QuantitySelector value={1} onChange={vi.fn()} />);
    expect(getAllByTestId('minus-icon').length).toBeGreaterThan(0);
    expect(getAllByTestId('plus-icon').length).toBeGreaterThan(0);
  });
});
