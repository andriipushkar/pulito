// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('./Modal', () => ({
  default: ({ isOpen, onClose, children }: any) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));
vi.mock('./Button', () => ({
  default: ({ children, onClick, disabled, isLoading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || isLoading} {...props}>
      {isLoading ? 'Loading...' : children}
    </button>
  ),
}));

import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  it('renders nothing when not open', () => {
    render(
      <ConfirmDialog isOpen={false} onClose={onClose} onConfirm={onConfirm} message="Are you sure?" />
    );
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="Are you sure?" />
    );
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('renders default title "Підтвердження"', () => {
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="Sure?" />
    );
    expect(screen.getByText('Підтвердження')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="Sure?" title="Delete?" />
    );
    expect(screen.getByText('Delete?')).toBeInTheDocument();
  });

  it('renders message', () => {
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="This action is irreversible" />
    );
    expect(screen.getByText('This action is irreversible')).toBeInTheDocument();
  });

  it('renders default button texts', () => {
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="Sure?" />
    );
    expect(screen.getByText('Підтвердити')).toBeInTheDocument();
    expect(screen.getByText('Скасувати')).toBeInTheDocument();
  });

  it('renders custom button texts', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        message="Sure?"
        confirmText="Yes, delete"
        cancelText="No, keep"
      />
    );
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
    expect(screen.getByText('No, keep')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    onConfirm.mockClear();
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="Sure?" />
    );
    fireEvent.click(screen.getByText('Підтвердити'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button is clicked', () => {
    onClose.mockClear();
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="Sure?" />
    );
    fireEvent.click(screen.getByText('Скасувати'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
