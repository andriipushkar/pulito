// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ success: true, data: [] }),
  post: vi.fn().mockResolvedValue({ success: true, data: { trackingNumber: '20450000000001' } }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
}));

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick, isLoading, variant, ...props }: any) => (
    <button onClick={onClick} disabled={isLoading} data-variant={variant} {...props}>
      {isLoading ? 'Loading...' : children}
    </button>
  ),
}));

import CreateTTNForm from './CreateTTNForm';

const defaultProps = {
  orderId: 123,
  recipientName: 'Іван Петренко',
  recipientPhone: '+380501234567',
  recipientCity: 'Київ',
  recipientWarehouseRef: null,
  orderAmount: 1500,
  onCreated: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('CreateTTNForm', () => {
  it('renders recipient fields as read-only', () => {
    render(<CreateTTNForm {...defaultProps} />);
    const recipientInput = screen.getByDisplayValue('Іван Петренко');
    expect(recipientInput).toHaveAttribute('readOnly');
    const phoneInput = screen.getByDisplayValue('+380501234567');
    expect(phoneInput).toHaveAttribute('readOnly');
  });

  it('renders city search input with placeholder', () => {
    render(<CreateTTNForm {...defaultProps} recipientCity={null} />);
    expect(screen.getByPlaceholderText('Пошук міста...')).toBeInTheDocument();
  });

  it('renders cargo description field with default', () => {
    render(<CreateTTNForm {...defaultProps} />);
    expect(screen.getByDisplayValue('Побутова хімія')).toBeInTheDocument();
  });

  it('shows validation error when sender fields are empty', async () => {
    render(<CreateTTNForm {...defaultProps} />);
    fireEvent.click(screen.getByText('Створити ТТН'));
    await waitFor(() => {
      expect(screen.getByText(/Заповніть дані відправника/)).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<CreateTTNForm {...defaultProps} />);
    fireEvent.click(screen.getByText('Скасувати'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('renders sender settings in a collapsible details element', () => {
    render(<CreateTTNForm {...defaultProps} />);
    expect(screen.getByText(/Дані відправника/)).toBeInTheDocument();
  });

  it('renders delivery type and payer selects', () => {
    render(<CreateTTNForm {...defaultProps} />);
    expect(screen.getByDisplayValue('Відділення-Відділення')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Отримувач')).toBeInTheDocument();
  });

  it('loads sender settings from localStorage on mount', () => {
    localStorage.setItem('np_sender_settings', JSON.stringify({
      senderRef: 'ref-123',
      senderAddressRef: 'addr-456',
      senderContactRef: 'contact-789',
      senderPhone: '+380991112233',
    }));
    render(<CreateTTNForm {...defaultProps} />);
    expect(screen.getByDisplayValue('ref-123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+380991112233')).toBeInTheDocument();
  });
});
