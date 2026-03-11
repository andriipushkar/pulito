// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/ui/Input', () => ({
  default: ({ label, error, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} {...props} />
      {error && <span>{error}</span>}
    </div>
  ),
}));
vi.mock('@/components/checkout/PalletDeliveryForm', () => ({
  default: () => <div data-testid="pallet-form" />,
}));
vi.mock('@/components/checkout/DeliveryCostEstimate', () => ({
  default: () => <div data-testid="delivery-estimate" />,
}));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn().mockResolvedValue({ success: false }) } }));

import StepDelivery from './StepDelivery';

describe('StepDelivery', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', () => {
    const { container } = render(<StepDelivery data={{}} errors={{}} onChange={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  it('shows address fields for nova_poshta', () => {
    render(
      <StepDelivery data={{ deliveryMethod: 'nova_poshta' as any }} errors={{}} onChange={vi.fn()} />
    );
    expect(screen.getByText('deliveryCity *')).toBeInTheDocument();
    expect(screen.getByText('deliveryAddress *')).toBeInTheDocument();
  });

  it('shows pallet form for pallet delivery', () => {
    render(
      <StepDelivery data={{ deliveryMethod: 'pallet' as any }} errors={{}} onChange={vi.fn()} />
    );
    expect(screen.getByTestId('pallet-form')).toBeInTheDocument();
  });

  it('shows delivery method error', () => {
    render(
      <StepDelivery data={{}} errors={{ deliveryMethod: 'Оберіть спосіб доставки' }} onChange={vi.fn()} />
    );
    expect(screen.getByText('Оберіть спосіб доставки')).toBeInTheDocument();
  });

  it('renders city and address error messages', () => {
    render(
      <StepDelivery
        data={{ deliveryMethod: 'nova_poshta' as any }}
        errors={{ deliveryCity: 'Обовязково', deliveryAddress: 'Обовязково' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getAllByText('Обовязково').length).toBe(2);
  });

  it('highlights selected delivery method', () => {
    const { container } = render(
      <StepDelivery data={{ deliveryMethod: 'nova_poshta' as any }} errors={{}} onChange={vi.fn()} />
    );
    const labels = container.querySelectorAll('label');
    const npLabel = Array.from(labels).find(l => l.textContent?.includes('Нова Пошта'));
    expect(npLabel?.className).toContain('border-[var(--color-primary)]');
  });





  it('renders delivery cost estimate component', () => {
    const { getAllByTestId } = render(<StepDelivery data={{}} errors={{}} onChange={vi.fn()} />);
    expect(getAllByTestId('delivery-estimate').length).toBeGreaterThan(0);
  });

  it('calls onChange when delivery method radio is clicked', () => {
    const handleChange = vi.fn();
    const { container } = render(<StepDelivery data={{}} errors={{}} onChange={handleChange} />);
    const radios = container.querySelectorAll('input[type="radio"][name="deliveryMethod"]');
    fireEvent.click(radios[0]);
    expect(handleChange).toHaveBeenCalledWith('deliveryMethod', 'nova_poshta');
  });

  it('renders all 4 delivery options', () => {
    const { container } = render(<StepDelivery data={{}} errors={{}} onChange={vi.fn()} />);
    const radios = container.querySelectorAll('input[type="radio"][name="deliveryMethod"]');
    expect(radios.length).toBe(4);
  });

  it('shows address fields for ukrposhta', () => {
    const { getByText } = render(
      <StepDelivery data={{ deliveryMethod: 'ukrposhta' as any }} errors={{}} onChange={vi.fn()} />
    );
    expect(getByText('deliveryCity *')).toBeInTheDocument();
    expect(getByText('deliveryAddress *')).toBeInTheDocument();
  });

  it('does not show address fields for pickup', () => {
    const { container } = render(
      <StepDelivery data={{ deliveryMethod: 'pickup' as any }} errors={{}} onChange={vi.fn()} />
    );
    const labels = container.querySelectorAll('label');
    const cityLabel = Array.from(labels).find(l => l.textContent === 'deliveryCity *');
    expect(cityLabel).toBeUndefined();
  });

  it('calls onChange with deliveryCity when city input changes', () => {
    const handleChange = vi.fn();
    render(
      <StepDelivery data={{ deliveryMethod: 'nova_poshta' as any }} errors={{}} onChange={handleChange} />
    );
    fireEvent.change(screen.getByLabelText('deliveryCity *'), { target: { value: 'Львів' } });
    expect(handleChange).toHaveBeenCalledWith('deliveryCity', 'Львів');
  });

  it('calls onChange with deliveryAddress when address input changes', () => {
    const handleChange = vi.fn();
    render(
      <StepDelivery data={{ deliveryMethod: 'nova_poshta' as any }} errors={{}} onChange={handleChange} />
    );
    fireEvent.change(screen.getByLabelText('deliveryAddress *'), { target: { value: 'Відділення №5' } });
    expect(handleChange).toHaveBeenCalledWith('deliveryAddress', 'Відділення №5');
  });

  it('shows ukrposhta placeholder for address', () => {
    const { container } = render(
      <StepDelivery data={{ deliveryMethod: 'ukrposhta' as any }} errors={{}} onChange={vi.fn()} />
    );
    const addressInput = container.querySelector('input[aria-label="deliveryAddress *"]');
    expect(addressInput).toHaveAttribute('placeholder', 'вул. Хрещатик, 1, кв. 1');
  });

  it('shows nova_poshta placeholder for address', () => {
    const { container } = render(
      <StepDelivery data={{ deliveryMethod: 'nova_poshta' as any }} errors={{}} onChange={vi.fn()} />
    );
    const addressInput = container.querySelector('input[aria-label="deliveryAddress *"]');
    expect(addressInput).toHaveAttribute('placeholder', 'Відділення №1, вул. Хрещатик, 1');
  });

  it('renders data values in city and address inputs', () => {
    render(
      <StepDelivery
        data={{ deliveryMethod: 'nova_poshta' as any, deliveryCity: 'Одеса', deliveryAddress: 'Відділення №3' }}
        errors={{}}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Одеса')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Відділення №3')).toBeInTheDocument();
  });
});
