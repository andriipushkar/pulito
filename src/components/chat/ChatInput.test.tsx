// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import ChatInput from './ChatInput';

describe('ChatInput', () => {
  const onSend = vi.fn();

  it('renders textarea', () => {
    render(<ChatInput onSend={onSend} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders send button', () => {
    render(<ChatInput onSend={onSend} />);
    expect(screen.getByLabelText('Надіслати')).toBeInTheDocument();
  });

  it('shows default placeholder', () => {
    render(<ChatInput onSend={onSend} />);
    expect(screen.getByPlaceholderText('Введіть повідомлення...')).toBeInTheDocument();
  });

  it('shows custom placeholder', () => {
    render(<ChatInput onSend={onSend} placeholder="Custom..." />);
    expect(screen.getByPlaceholderText('Custom...')).toBeInTheDocument();
  });

  it('shows disabled placeholder when disabled', () => {
    render(<ChatInput onSend={onSend} disabled />);
    expect(screen.getByPlaceholderText('Чат закрито')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<ChatInput onSend={onSend} />);
    expect(screen.getByLabelText('Надіслати')).toBeDisabled();
  });

  it('enables send button when input has text', () => {
    render(<ChatInput onSend={onSend} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
    expect(screen.getByLabelText('Надіслати')).not.toBeDisabled();
  });

  it('calls onSend and clears input on send button click', () => {
    onSend.mockClear();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByLabelText('Надіслати'));
    expect(onSend).toHaveBeenCalledWith('Hello');
    expect(textarea).toHaveValue('');
  });

  it('sends on Enter key (without Shift)', () => {
    onSend.mockClear();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Test');
  });

  it('does not send on Shift+Enter', () => {
    onSend.mockClear();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send empty or whitespace-only messages', () => {
    onSend.mockClear();
    render(<ChatInput onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText('Надіслати'));
    expect(onSend).not.toHaveBeenCalled();
  });
});
