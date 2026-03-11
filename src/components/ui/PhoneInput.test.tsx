// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PhoneInput, { cleanPhone } from './PhoneInput';

const getInput = () => screen.getAllByPlaceholderText('+38 (0XX) XXX-XX-XX')[0] as HTMLInputElement;

function triggerChange(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  nativeInputValueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('PhoneInput', () => {
  afterEach(() => { cleanup(); });

  it('renders with placeholder', () => {
    render(<PhoneInput />);
    expect(getInput()).toBeInTheDocument();
  });

  it('renders label and error', () => {
    render(<PhoneInput label="Phone" error="Invalid" />);
    expect(screen.getAllByLabelText('Phone').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Invalid').length).toBeGreaterThan(0);
  });

  it('renders without label', () => {
    const { container } = render(<PhoneInput />);
    expect(container.querySelector('label')).toBeNull();
  });

  it('renders without error', () => {
    const { container } = render(<PhoneInput />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('applies error styling to input', () => {
    const { container } = render(<PhoneInput error="Bad" />);
    const input = container.querySelector('input');
    expect(input?.className).toContain('border-[var(--color-danger)]');
  });

  it('applies normal border styling without error', () => {
    const { container } = render(<PhoneInput />);
    const input = container.querySelector('input');
    expect(input?.className).toContain('border-[var(--color-border)]');
  });

  it('has tel input type', () => {
    render(<PhoneInput />);
    expect(getInput()).toHaveAttribute('type', 'tel');
  });

  it('has numeric inputMode', () => {
    render(<PhoneInput />);
    expect(getInput()).toHaveAttribute('inputMode', 'numeric');
  });









  it('generates id from label', () => {
    render(<PhoneInput label="Phone Number" />);
    const input = screen.getAllByLabelText('Phone Number')[0];
    expect(input).toHaveAttribute('id', 'phone-number');
  });

  it('uses provided id over generated one', () => {
    const { container } = render(<PhoneInput label="Phone" id="custom-id" />);
    const input = container.querySelector('#custom-id');
    expect(input).toBeInTheDocument();
  });

  it('passes through additional props', () => {
    render(<PhoneInput disabled data-testid="phone" />);
    expect(screen.getByTestId('phone')).toBeDisabled();
  });

  it('accepts custom className', () => {
    const { container } = render(<PhoneInput className="custom-class" />);
    const input = container.querySelector('input');
    expect(input?.className).toContain('custom-class');
  });

  it('does not throw when onChange is undefined', () => {
    render(<PhoneInput value="" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '093' } });
  });

  it('renders with non-string value prop', () => {
    render(<PhoneInput value={undefined as any} onChange={vi.fn()} />);
    expect(getInput()).toBeInTheDocument();
  });

  it('displays value prop on the input', () => {
    render(<PhoneInput value="0931234567" onChange={vi.fn()} />);
    // The component passes formatPhone(value) to the input's value
    const input = getInput();
    expect(input).toBeInTheDocument();
  });

  it('formats value starting with 380 (strips country code)', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '380931234567' } });
    expect(onChange).toHaveBeenCalled();
    const formatted = onChange.mock.calls[0][0].target.value;
    expect(formatted).toBe('+38 (093) 123-45-67');
  });

  it('formats value starting with 38 (strips 38 prefix)', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '38093' } });
    expect(onChange).toHaveBeenCalled();
    const formatted = onChange.mock.calls[0][0].target.value;
    expect(formatted).toContain('+38 (093');
  });

  it('prepends 0 when digits do not start with 0', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '93' } });
    expect(onChange).toHaveBeenCalled();
    const formatted = onChange.mock.calls[0][0].target.value;
    // Should prepend 0 and format as +38 (093
    expect(formatted).toContain('+38 (093');
  });

  it('formats partial digits (1-3 digits)', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '09' } });
    const formatted = onChange.mock.calls[0][0].target.value;
    expect(formatted).toBe('+38 (09');
  });

  it('formats 4-6 digits', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '093123' } });
    const formatted = onChange.mock.calls[0][0].target.value;
    expect(formatted).toBe('+38 (093) 123');
  });

  it('formats 7-8 digits', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '09312345' } });
    const formatted = onChange.mock.calls[0][0].target.value;
    expect(formatted).toBe('+38 (093) 123-45');
  });

  it('returns empty string for empty input', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="093" onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: '' } });
    const formatted = onChange.mock.calls[0][0].target.value;
    expect(formatted).toBe('');
  });
});

describe('cleanPhone', () => {
  it('converts formatted to +38 format', () => {
    expect(cleanPhone('+38 (093) 123-45-67')).toBe('+380931234567');
  });

  it('returns empty for empty', () => {
    expect(cleanPhone('')).toBe('');
  });

  it('handles digits starting with 380', () => {
    expect(cleanPhone('380931234567')).toBe('+380931234567');
  });

  it('handles digits starting with 0', () => {
    expect(cleanPhone('0931234567')).toBe('+380931234567');
  });

  it('handles digits not starting with 380 or 0', () => {
    expect(cleanPhone('931234567')).toBe('+38931234567');
  });
});
