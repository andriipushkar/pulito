// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DualRangeSlider from './DualRangeSlider';

describe('DualRangeSlider', () => {
  afterEach(() => cleanup());

  const defaultProps = {
    min: 0,
    max: 10000,
    value: [1000, 5000] as [number, number],
    onChange: vi.fn(),
  };

  it('renders with initial values', () => {
    render(<DualRangeSlider {...defaultProps} />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);
    expect(sliders[0]).toHaveAttribute('aria-valuenow', '1000');
    expect(sliders[1]).toHaveAttribute('aria-valuenow', '5000');
  });

  it('respects min/max bounds via aria attributes', () => {
    render(<DualRangeSlider {...defaultProps} />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders[0]).toHaveAttribute('aria-valuemin', '0');
    expect(sliders[0]).toHaveAttribute('aria-valuemax', '10000');
    expect(sliders[1]).toHaveAttribute('aria-valuemin', '0');
    expect(sliders[1]).toHaveAttribute('aria-valuemax', '10000');
  });

  it('fires onChange with correct values on keyboard ArrowRight for min thumb', () => {
    const onChange = vi.fn();
    render(<DualRangeSlider {...defaultProps} onChange={onChange} step={50} />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.keyDown(sliders[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith([1050, 5000]);
  });

  it('fires onChange with correct values on keyboard ArrowLeft for max thumb', () => {
    const onChange = vi.fn();
    render(<DualRangeSlider {...defaultProps} onChange={onChange} step={50} />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.keyDown(sliders[1], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith([1000, 4950]);
  });

  it('does not allow min thumb to exceed max thumb via keyboard', () => {
    const onChange = vi.fn();
    render(
      <DualRangeSlider
        min={0}
        max={10000}
        value={[5000, 5000]}
        onChange={onChange}
        step={50}
      />,
    );
    const sliders = screen.getAllByRole('slider');
    fireEvent.keyDown(sliders[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith([5000, 5000]);
  });

  it('displays formatted labels when formatLabel is provided', () => {
    const formatLabel = (v: number) => `${v} ₴`;
    render(<DualRangeSlider {...defaultProps} formatLabel={formatLabel} />);
    expect(screen.getByText('1000 ₴')).toBeInTheDocument();
    expect(screen.getByText('5000 ₴')).toBeInTheDocument();
  });

  it('displays default labels as text spans', () => {
    const { container } = render(<DualRangeSlider {...defaultProps} />);
    const labelSpans = container.querySelectorAll('.relative.mb-1 span');
    expect(labelSpans).toHaveLength(2);
    expect(labelSpans[0].textContent).toBe('1000');
    expect(labelSpans[1].textContent).toBe('5000');
  });

  it('has accessible aria-labels in Ukrainian', () => {
    render(<DualRangeSlider {...defaultProps} />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders[0]).toHaveAttribute('aria-label', 'Мінімальна ціна');
    expect(sliders[1]).toHaveAttribute('aria-label', 'Максимальна ціна');
  });
});
