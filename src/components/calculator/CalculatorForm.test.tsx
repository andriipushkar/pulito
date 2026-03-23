// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick, disabled, type, ...props }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

import CalculatorForm from './CalculatorForm';

describe('CalculatorForm', () => {
  const onCalculate = vi.fn();

  it('renders family size label', () => {
    render(<CalculatorForm onCalculate={onCalculate} isLoading={false} />);
    expect(screen.getByText(/Кількість членів сім'ї/)).toBeInTheDocument();
  });

  it('renders wash loads label', () => {
    render(<CalculatorForm onCalculate={onCalculate} isLoading={false} />);
    expect(screen.getByText(/Прань на тиждень/)).toBeInTheDocument();
  });

  it('renders cleaning frequency label', () => {
    render(<CalculatorForm onCalculate={onCalculate} isLoading={false} />);
    expect(screen.getByText('Частота прибирання')).toBeInTheDocument();
  });

  it('renders cleaning frequency options', () => {
    render(<CalculatorForm onCalculate={onCalculate} isLoading={false} />);
    expect(screen.getByText('Щодня')).toBeInTheDocument();
    expect(screen.getByText('Раз на тиждень')).toBeInTheDocument();
    expect(screen.getByText('Раз на 2 тижні')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<CalculatorForm onCalculate={onCalculate} isLoading={false} />);
    expect(screen.getByText('Розрахувати')).toBeInTheDocument();
  });

  it('shows loading text when isLoading is true', () => {
    render(<CalculatorForm onCalculate={onCalculate} isLoading={true} />);
    expect(screen.getByText('Розраховую...')).toBeInTheDocument();
  });

  it('calls onCalculate with default values on submit', () => {
    onCalculate.mockClear();
    render(<CalculatorForm onCalculate={onCalculate} isLoading={false} />);
    fireEvent.click(screen.getByText('Розрахувати'));
    expect(onCalculate).toHaveBeenCalledWith({
      familySize: 3,
      washLoadsPerWeek: 4,
      cleaningFrequency: 'weekly',
    });
  });

  it('updates cleaning frequency when option is clicked', () => {
    onCalculate.mockClear();
    render(<CalculatorForm onCalculate={onCalculate} isLoading={false} />);
    fireEvent.click(screen.getByText('Щодня'));
    fireEvent.click(screen.getByText('Розрахувати'));
    expect(onCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ cleaningFrequency: 'daily' })
    );
  });

  it('disables submit button when isLoading', () => {
    render(<CalculatorForm onCalculate={onCalculate} isLoading={true} />);
    expect(screen.getByText('Розраховую...')).toBeDisabled();
  });
});
