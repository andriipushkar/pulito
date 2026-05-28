'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface Props {
  value: string;
  label?: string;
  className?: string;
  /** When true, renders the value next to the button. */
  showValue?: boolean;
  children?: ReactNode;
  /** Custom toast text (defaults to the localised "Copied"). */
  toastText?: string;
}

export default function CopyButton({
  value,
  label,
  className = '',
  showValue,
  children,
  toastText,
}: Props) {
  const t = useTranslations('admin.copyButton');
  const [copied, setCopied] = useState(false);
  const copyTitle = label ? t('copyLabel', { label }) : t('copy');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(toastText ?? t('copied'), { duration: 1500 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  if (children) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={copyTitle}
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
      aria-label={copyTitle}
      title={copyTitle}
      className={`inline-flex items-center gap-1 rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)] ${className}`}
    >
      {showValue && <span className="truncate text-xs">{value}</span>}
      <span aria-hidden="true" className="text-xs">
        {copied ? '✓' : '📋'}
      </span>
    </button>
  );
}
