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
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ success: false }) },
}));

import StepDelivery from './StepDelivery';

describe('StepDelivery', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', () => {
    const { container } = render(<StepDelivery data={{}} errors={{}} onChange={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  it('shows Nova Poshta picker fields for nova_poshta', () => {
    render(
      <StepDelivery
        data={{ deliveryMethod: 'nova_poshta' as any }}
        errors={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Місто *')).toBeInTheDocument();
  });

  it('shows pallet form for pallet delivery', () => {
    render(
      <StepDelivery data={{ deliveryMethod: 'pallet' as any }} errors={{}} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId('pallet-form')).toBeInTheDocument();
  });

  it('shows delivery method error', () => {
    render(
      <StepDelivery
        data={{}}
        errors={{ deliveryMethod: 'Оберіть спосіб доставки' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Оберіть спосіб доставки')).toBeInTheDocument();
  });

  it('renders city error message in NP picker', () => {
    render(
      <StepDelivery
        data={{ deliveryMethod: 'nova_poshta' as any }}
        errors={{ deliveryCity: 'Обовязково' }}
        onChange={vi.fn()}
      />,
    );
    // Picker shows the city error; warehouse picker is hidden until cityRef is set.
    expect(screen.getAllByText('Обовязково').length).toBeGreaterThanOrEqual(1);
  });

  it('highlights selected delivery method', () => {
    const { container } = render(
      <StepDelivery
        data={{ deliveryMethod: 'nova_poshta' as any }}
        errors={{}}
        onChange={vi.fn()}
      />,
    );
    const labels = container.querySelectorAll('label');
    const npLabel = Array.from(labels).find((l) => l.textContent?.includes('Нова Пошта'));
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

  it('shows Ukrposhta picker for ukrposhta method', () => {
    const { getByText } = render(
      <StepDelivery data={{ deliveryMethod: 'ukrposhta' as any }} errors={{}} onChange={vi.fn()} />,
    );
    expect(getByText('Місто *')).toBeInTheDocument();
    expect(getByText(/Адреса \(вулиця/)).toBeInTheDocument();
  });

  it('does not show address fields for pickup', () => {
    const { container } = render(
      <StepDelivery data={{ deliveryMethod: 'pickup' as any }} errors={{}} onChange={vi.fn()} />,
    );
    const labels = container.querySelectorAll('label');
    const cityLabel = Array.from(labels).find((l) => l.textContent === 'deliveryCity *');
    expect(cityLabel).toBeUndefined();
  });

  it('shows Nova Poshta autocomplete picker for nova_poshta method', () => {
    const { getByText } = render(
      <StepDelivery
        data={{ deliveryMethod: 'nova_poshta' as any }}
        errors={{}}
        onChange={vi.fn()}
      />,
    );
    // New picker uses "Місто" / "Відділення" labels (was: deliveryCity / deliveryAddress).
    expect(getByText('Місто *')).toBeInTheDocument();
    expect(getByText(/Спочатку оберіть місто/)).toBeInTheDocument();
  });

  it('renders ukrposhta address input with placeholder', () => {
    const { container } = render(
      <StepDelivery data={{ deliveryMethod: 'ukrposhta' as any }} errors={{}} onChange={vi.fn()} />,
    );
    const addressInput = container.querySelector('input[placeholder*="Хрещатик"]');
    expect(addressInput).toBeInTheDocument();
  });

  it('renders data values in nova_poshta picker when city already selected', () => {
    render(
      <StepDelivery
        data={{
          deliveryMethod: 'nova_poshta' as any,
          deliveryCity: 'Одеса',
          deliveryAddress: 'Відділення №3',
        }}
        errors={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Одеса')).toBeInTheDocument();
  });
});
