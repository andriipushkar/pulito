// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import BulkOrderForm from './BulkOrderForm';

describe('BulkOrderForm', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('renders the form label', () => {
    render(<BulkOrderForm />);
    expect(screen.getByText(/Введіть артикули товарів/)).toBeInTheDocument();
  });

  it('renders a textarea for input', () => {
    render(<BulkOrderForm />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('renders the calculate button', () => {
    render(<BulkOrderForm />);
    expect(screen.getByText('Розрахувати')).toBeInTheDocument();
  });

  it('disables the button when input is empty', () => {
    render(<BulkOrderForm />);
    const btn = screen.getByText('Розрахувати');
    expect(btn).toBeDisabled();
  });

  it('enables the button when input has text', () => {
    render(<BulkOrderForm />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'АРТ-001, 10' } });
    const btn = screen.getByText('Розрахувати');
    expect(btn).not.toBeDisabled();
  });

  it('renders format hint text', () => {
    render(<BulkOrderForm />);
    expect(screen.getByText(/Формат: код артикулу/)).toBeInTheDocument();
  });

  it('calls fetch on resolve and displays results table', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items: [
            { productId: 1, code: 'АРТ-001', name: 'Product 1', quantity: 10, price: 50, total: 500, available: 100 },
          ],
          totalAmount: 500,
          errors: [],
        },
      }),
    });

    render(<BulkOrderForm />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'АРТ-001, 10' } });
    fireEvent.click(screen.getByText('Розрахувати'));

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument();
    });
    expect(screen.getByText('500.00')).toBeInTheDocument();
  });

  it('renders errors/warnings from the response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items: [],
          totalAmount: 0,
          errors: ['Товар АРТ-999 не знайдено'],
        },
      }),
    });

    render(<BulkOrderForm />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'АРТ-999, 5' } });
    fireEvent.click(screen.getByText('Розрахувати'));

    await waitFor(() => {
      expect(screen.getByText('Попередження')).toBeInTheDocument();
    });
    expect(screen.getByText(/Товар АРТ-999 не знайдено/)).toBeInTheDocument();
  });

  it('renders generate proposal button after results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items: [
            { productId: 1, code: 'АРТ-001', name: 'P1', quantity: 10, price: 50, total: 500, available: 100 },
          ],
          totalAmount: 500,
          errors: [],
        },
      }),
    });

    render(<BulkOrderForm />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'АРТ-001, 10' } });
    fireEvent.click(screen.getByText('Розрахувати'));

    await waitFor(() => {
      expect(screen.getByText(/Згенерувати комерційну пропозицію/)).toBeInTheDocument();
    });
  });
});
