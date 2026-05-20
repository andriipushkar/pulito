'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

interface Props {
  value: string;
  label?: string;
  className?: string;
  /** When true, renders the value next to the button. */
  showValue?: boolean;
  children?: ReactNode;
  /** Custom toast text (defaults to "Скопійовано"). */
  toastText?: string;
}

export default function CopyButton({
  value,
  label,
  className = '',
  showValue,
  children,
  toastText = 'Скопійовано',
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(toastText, { duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Не вдалося скопіювати');
    }
  };

  if (children) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={`Копіювати${label ? ` ${label}` : ''}`}
        className={`inline-flex items-center gap-1 hover:text-[var(--color-primary)] ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Копіювати${label ? ` ${label}` : ''}`}
      title={`Копіювати${label ? ` ${label}` : ''}`}
      className={`inline-flex items-center gap-1 rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)] ${className}`}
    >
      {showValue && <span className="truncate text-xs">{value}</span>}
      <span aria-hidden="true" className="text-xs">
        {copied ? '✓' : '📋'}
      </span>
    </button>
  );
}
