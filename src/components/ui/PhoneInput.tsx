'use client';

import { forwardRef, useCallback, type ChangeEvent, type InputHTMLAttributes } from 'react';

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  label?: string;
  error?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Formats digits into +38 (0XX) XXX-XX-XX pattern.
 * Accepts raw digits (with or without leading 38/+38).
 */
function formatPhone(raw: string): string {
  // Strip everything except digits
  let digits = raw.replace(/\D/g, '');

  // Remove leading country code if present
  if (digits.startsWith('380')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('38')) {
    digits = digits.slice(2);
  }

  // Ensure starts with 0
  if (digits.length > 0 && digits[0] !== '0') {
    digits = '0' + digits;
  }

  // Limit to 10 digits (Ukrainian phone)
  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `+38 (${digits}`;
  if (digits.length <= 6) return `+38 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 8) return `+38 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `+38 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/** Extracts clean digits from formatted phone, returns with +38 prefix */
export function cleanPhone(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith('380')) return '+' + digits;
  if (digits.startsWith('0')) return '+38' + digits;
  return '+38' + digits;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, className = '', id, onChange, value, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value);
        // Create a synthetic event-like object with formatted value
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: formatted },
        } as ChangeEvent<HTMLInputElement>;
        onChange?.(syntheticEvent);
      },
      [onChange]
    );

    // Format the display value
    const displayValue = typeof value === 'string' ? formatPhone(value) : value;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-text)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="numeric"
          className={`rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
          } bg-[var(--color-bg)] text-[var(--color-text)] ${className}`}
          placeholder="+38 (0XX) XXX-XX-XX"
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    );
  }
);
PhoneInput.displayName = 'PhoneInput';
export default PhoneInput;
