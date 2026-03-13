// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: mockPost },
}));
vi.mock('@/components/ui/Input', () => ({
  default: ({ label, error, ...props }: any) => (
    <label>
      {label}
      <input {...props} />
      {error && <span className="error">{error}</span>}
    </label>
  ),
}));

import PalletDeliveryForm from './PalletDeliveryForm';

describe('PalletDeliveryForm', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onChange = vi.fn();
    mockPost.mockResolvedValue({ success: false });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders heading and calculate button', () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    expect(container.textContent).toContain('Палетна доставка');
    expect(container.textContent).toContain('Розрахувати вартість');
  });

  it('renders region select with options', () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll('option');
    // 5 regions + 1 placeholder
    expect(options).toHaveLength(6);
    expect(options[0].textContent).toBe('Оберіть регіон');
  });

  it('renders weight input and address/city inputs', () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    expect(container.textContent).toContain('Вага замовлення (кг) *');
    expect(container.textContent).toContain('Адреса доставки *');
    expect(container.textContent).toContain('Місто *');
  });

  it('shows error when calculating with empty weight', async () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )!;
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Введіть вагу');
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows error when calculating with zero weight', async () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    // Set weight to 0
    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '0' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )!;
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Введіть вагу');
    });
  });

  it('calls apiClient.post and shows result on success', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { cost: 1500, estimatedDays: '3-5', isFreeDelivery: false },
    });

    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);

    // Set weight
    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '200' } });

    // Set region
    const select = container.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'Захід' } });

    // Click calculate
    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )!;
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('1500 грн');
      expect(container.textContent).toContain('3-5');
    });

    expect(mockPost).toHaveBeenCalledWith('/api/v1/delivery/pallet/calculate', {
      weightKg: 200,
      region: 'Захід',
    });
    expect(onChange).toHaveBeenCalledWith('palletWeightKg', '200');
    expect(onChange).toHaveBeenCalledWith('palletRegion', 'Захід');
    expect(onChange).toHaveBeenCalledWith('palletDeliveryCost', '1500');
  });

  it('shows free delivery text when isFreeDelivery is true', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { cost: 0, estimatedDays: '2-3', isFreeDelivery: true },
    });

    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '500' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )!;
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Безкоштовно');
    });
  });

  it('shows error message on API failure', async () => {
    mockPost.mockResolvedValue({
      success: false,
      error: 'Сервер недоступний',
    });

    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '100' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )!;
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Сервер недоступний');
    });
  });

  it('shows default error message when API returns no error text', async () => {
    mockPost.mockResolvedValue({ success: false });

    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '100' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )!;
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Помилка розрахунку');
    });
  });

  it('shows loading state while calculating', async () => {
    let resolvePost: (v: any) => void;
    mockPost.mockImplementation(
      () => new Promise((resolve) => { resolvePost = resolve; }),
    );

    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '100' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )! as HTMLButtonElement;
    fireEvent.click(calcBtn);

    // Should show loading state
    await waitFor(() => {
      expect(container.textContent).toContain('Розраховуємо...');
    });
    expect(calcBtn.disabled).toBe(true);

    // Resolve the promise
    resolvePost!({ success: false });

    await waitFor(() => {
      expect(container.textContent).toContain('Розрахувати вартість');
    });
  });

  it('sends undefined region when none selected', async () => {
    mockPost.mockResolvedValue({ success: false });

    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '50' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Розрахувати'),
    )!;
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/delivery/pallet/calculate', {
        weightKg: 50,
        region: undefined,
      });
    });
  });

  it('calls onChange for address and city inputs', () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    const allInputs = container.querySelectorAll('input:not([type="number"])');
    // Address input (placeholder = "Адреса складу або підприємства")
    const addressInput = container.querySelector('input[placeholder="Адреса складу або підприємства"]') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: 'вул. Хрещатик 1' } });
    expect(onChange).toHaveBeenCalledWith('deliveryAddress', 'вул. Хрещатик 1');

    // City input
    const cityInput = container.querySelector('input[placeholder="Київ"]') as HTMLInputElement;
    fireEvent.change(cityInput, { target: { value: 'Львів' } });
    expect(onChange).toHaveBeenCalledWith('deliveryCity', 'Львів');
  });

  it('displays errors from props', () => {
    const errors = { palletWeightKg: 'Обов\'язкове поле', deliveryAddress: 'Введіть адресу', deliveryCity: 'Введіть місто' };
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={errors} />);
    expect(container.textContent).toContain('Обов\'язкове поле');
    expect(container.textContent).toContain('Введіть адресу');
    expect(container.textContent).toContain('Введіть місто');
  });

  it('changes weight input value', () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '300' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('300');
  });

  it('changes region select value', () => {
    const { container } = render(<PalletDeliveryForm onChange={onChange as any} errors={{}} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'Південь' } });
    expect(select.value).toBe('Південь');
  });
});
