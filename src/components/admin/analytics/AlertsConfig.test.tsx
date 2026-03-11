// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: any[]) => mockGet(...a), post: (...a: any[]) => mockPost(...a), put: (...a: any[]) => mockPut(...a), delete: (...a: any[]) => mockDelete(...a) },
}));
vi.mock('@/components/ui/Button', () => ({ default: ({ children, onClick, isLoading, disabled, ...props }: any) => <button onClick={onClick} disabled={disabled || isLoading} {...props}>{isLoading ? 'Loading...' : children}</button> }));
vi.mock('@/components/ui/Input', () => ({ default: ({ label, ...props }: any) => <label>{label}<input {...props} /></label> }));
vi.mock('@/components/ui/Select', () => ({ default: ({ options, ...props }: any) => <select {...props}>{options?.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));

import AlertsConfig from './AlertsConfig';

describe('AlertsConfig', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('shows loading text initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AlertsConfig />);
    expect(container.textContent).toContain('Завантаження');
  });

  it('renders empty state', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сповіщень немає');
    });
  });

  it('renders alerts list with active alert', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: '1', metric: 'daily_revenue', condition: 'below', threshold: 100, channel: 'telegram', isActive: true }] });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Денна виручка');
      expect(container.textContent).toContain('<');
      expect(container.textContent).toContain('100');
      expect(container.textContent).toContain('telegram');
    });
  });

  it('renders alert with above condition', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: '2', metric: 'daily_orders', condition: 'above', threshold: 50, channel: 'email', isActive: false }] });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Кількість замовлень');
      expect(container.textContent).toContain('>');
      expect(container.textContent).toContain('50');
      expect(container.textContent).toContain('email');
    });
  });

  it('renders alert with unknown metric falls back to key', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: '3', metric: 'unknown_metric', condition: 'below', threshold: 10, channel: 'telegram', isActive: true }] });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('unknown_metric');
    });
  });

  it('toggles alert active state', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: '1', metric: 'daily_revenue', condition: 'below', threshold: 100, channel: 'telegram', isActive: true }] });
    mockPut.mockResolvedValue({ success: true });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Денна виручка');
    });

    const toggleBtn = container.querySelector('button.h-4')!;
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/v1/admin/analytics/alerts/1', { isActive: false });
    });
  });

  it('handles API returning no data (success: false)', async () => {
    mockGet.mockResolvedValue({ success: false });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сповіщень немає');
    });
  });

  it('renders inactive alert with different styling', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: '1', metric: 'daily_revenue', condition: 'below', threshold: 100, channel: 'telegram', isActive: false }] });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      const toggleBtn = container.querySelector('button.h-4')!;
      expect(toggleBtn.className).toContain('bg-gray-300');
    });
  });

  it('deletes alert when delete is confirmed (line 81, 134)', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: '1', metric: 'daily_revenue', condition: 'below', threshold: 100, channel: 'telegram', isActive: true }] });
    mockDelete.mockResolvedValue({ success: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Денна виручка');
    });

    const deleteBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Видалити');
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Видалити сповіщення?');
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/admin/analytics/alerts/1');
    });
  });

  it('does not delete alert when confirm is cancelled (line 81)', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: '1', metric: 'daily_revenue', condition: 'below', threshold: 100, channel: 'telegram', isActive: true }] });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Денна виручка');
    });

    const deleteBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Видалити');
    fireEvent.click(deleteBtn!);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('shows form when Додати button is clicked and hides on Скасувати', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Сповіщень немає');
    });

    // Click "Додати" button to show form
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Додати');
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn!);

    // Form should now be visible with selects and input
    await waitFor(() => {
      expect(container.textContent).toContain('Метрика');
      expect(container.textContent).toContain('Умова');
      expect(container.textContent).toContain('Порогове значення');
      expect(container.textContent).toContain('Канал');
      expect(container.textContent).toContain('Створити');
    });

    // Toggle form off
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Скасувати');
    fireEvent.click(cancelBtn!);

    expect(container.textContent).not.toContain('Метрика');
  });

  it('saves new alert via form (lines 90-107)', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    mockPost.mockResolvedValue({ success: true });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Додати');
    });

    // Open form
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Додати');
    fireEvent.click(addBtn!);

    await waitFor(() => {
      expect(container.textContent).toContain('Створити');
    });

    // Fill threshold
    const thresholdInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(thresholdInput, { target: { value: '500' } });

    // Change metric select
    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'daily_orders' } });

    // Change condition select
    fireEvent.change(selects[1], { target: { value: 'above' } });

    // Change channel select
    fireEvent.change(selects[2], { target: { value: 'email' } });

    // Click Створити
    const createBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Створити');
    fireEvent.click(createBtn!);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/admin/analytics/alerts', {
        metric: 'daily_orders',
        condition: 'above',
        threshold: 500,
        channel: 'email',
      });
    });
  });

  it('resets form after successful save', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    mockPost.mockResolvedValue({ success: true });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Додати');
    });

    // Open form
    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Додати');
    fireEvent.click(addBtn!);

    // Fill threshold
    const thresholdInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(thresholdInput, { target: { value: '500' } });

    // Click Створити
    const createBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Створити');
    fireEvent.click(createBtn!);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    // Form should be hidden after success
    await waitFor(() => {
      expect(container.textContent).not.toContain('Метрика');
    });
  });

  it('create button is disabled when threshold is empty', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    const { container } = render(<AlertsConfig />);
    await waitFor(() => {
      expect(container.textContent).toContain('Додати');
    });

    const addBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Додати');
    fireEvent.click(addBtn!);

    const createBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Створити');
    expect(createBtn).toBeTruthy();
    expect(createBtn!.hasAttribute('disabled')).toBe(true);
  });
});
