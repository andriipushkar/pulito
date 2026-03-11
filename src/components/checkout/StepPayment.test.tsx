// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import StepPayment from './StepPayment';

describe('StepPayment', () => {
  it('renders without crashing', () => {
    const { container } = render(<StepPayment data={{}} errors={{}} onChange={vi.fn()} />);
    expect(container).toBeTruthy();
  });




  it('shows online providers when online payment selected', () => {
    render(
      <StepPayment data={{ paymentMethod: 'online' as any }} errors={{}} onChange={vi.fn()} />
    );
    expect(screen.getByText('selectProvider')).toBeInTheDocument();
    expect(screen.getByText('LiqPay')).toBeInTheDocument();
    expect(screen.getByText('Monobank')).toBeInTheDocument();
  });




  it('shows payment method error', () => {
    render(
      <StepPayment data={{}} errors={{ paymentMethod: 'Оберіть спосіб оплати' }} onChange={vi.fn()} />
    );
    expect(screen.getByText('Оберіть спосіб оплати')).toBeInTheDocument();
  });




  it('shows comment error', () => {
    render(
      <StepPayment data={{}} errors={{ comment: 'Too long' }} onChange={vi.fn()} />
    );
    expect(screen.getByText('Too long')).toBeInTheDocument();
  });

  it('renders textarea with error border style', () => {
    const { container } = render(
      <StepPayment data={{}} errors={{ comment: 'Error' }} onChange={vi.fn()} />
    );
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('border-[var(--color-danger)]');
  });

  it('renders textarea without error border when no error', () => {
    const { container } = render(
      <StepPayment data={{}} errors={{}} onChange={vi.fn()} />
    );
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('border-[var(--color-border)]');
  });


  it('highlights selected payment method', () => {
    const { container } = render(
      <StepPayment data={{ paymentMethod: 'bank_transfer' as any }} errors={{}} onChange={vi.fn()} />
    );
    const labels = container.querySelectorAll('label');
    const bankLabel = Array.from(labels).find(l => l.textContent?.includes('На розрахунковий рахунок'));
    expect(bankLabel?.className).toContain('border-[var(--color-primary)]');
  });




  it('highlights selected provider', () => {
    const { container } = render(
      <StepPayment data={{ paymentMethod: 'online' as any, paymentProvider: 'monobank' }} errors={{}} onChange={vi.fn()} />
    );
    const labels = container.querySelectorAll('label');
    const monobankLabel = Array.from(labels).find(l => l.textContent?.includes('Monobank'));
    expect(monobankLabel?.className).toContain('border-[var(--color-primary)]');
  });


  it('calls onChange when comment textarea changes', () => {
    const onChange = vi.fn();
    const { container } = render(
      <StepPayment data={{}} errors={{}} onChange={onChange} />
    );
    const textarea = container.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: 'My comment' } });
    expect(onChange).toHaveBeenCalledWith('comment', 'My comment');
  });

  it('calls onChange when a payment method radio is clicked', () => {
    const handleChange = vi.fn();
    const { container } = render(<StepPayment data={{}} errors={{}} onChange={handleChange} />);
    const radios = container.querySelectorAll('input[type="radio"][name="paymentMethod"]');
    fireEvent.click(radios[0]);
    expect(handleChange).toHaveBeenCalledWith('paymentMethod', 'cod');
  });

  it('renders all 4 payment options', () => {
    const { container } = render(<StepPayment data={{}} errors={{}} onChange={vi.fn()} />);
    const radios = container.querySelectorAll('input[type="radio"][name="paymentMethod"]');
    expect(radios.length).toBe(4);
  });

  it('does not show providers when non-online payment selected', () => {
    const { container } = render(
      <StepPayment data={{ paymentMethod: 'cod' as any }} errors={{}} onChange={vi.fn()} />
    );
    const providerRadios = container.querySelectorAll('input[type="radio"][name="paymentProvider"]');
    expect(providerRadios.length).toBe(0);
  });

  it('calls onChange with paymentProvider when provider radio is clicked', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <StepPayment data={{ paymentMethod: 'online' as any }} errors={{}} onChange={handleChange} />
    );
    const providerRadios = container.querySelectorAll('input[type="radio"][name="paymentProvider"]');
    fireEvent.click(providerRadios[0]);
    expect(handleChange).toHaveBeenCalledWith('paymentProvider', 'liqpay');
  });
});
