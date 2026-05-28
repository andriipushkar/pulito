'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Input from '@/components/ui/Input';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import { gtinValidationError } from '@/utils/gtin';

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Optional callback fired after a successful scan/manual entry of a valid
   *  8-14 digit code (via Enter, blur, or camera scan). Should return a
   *  Promise so the input can show a spinner while it runs. */
  onScanned?: (barcode: string) => void | Promise<void>;
  /** Hide the hint text below the input. */
  hideLookupHint?: boolean;
}

/**
 * Barcode input with camera scanner. Triggers `onScanned`:
 *  - immediately after a camera scan
 *  - on Enter key inside the input
 *  - on blur, if value is a valid 8-14 digit code
 */
export default function BarcodeInput({ value, onChange, onScanned, hideLookupHint }: Props) {
  const t = useTranslations('admin.barcodeInput');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isLooking, setIsLooking] = useState(false);

  const runLookup = async (code: string) => {
    const v = code.trim();
    if (!v) return;
    const validationError = gtinValidationError(v);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!onScanned) return;
    setIsLooking(true);
    try {
      await onScanned(v);
    } finally {
      setIsLooking(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
        {t('label')}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 14))}
            onBlur={(e) => runLookup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runLookup((e.target as HTMLInputElement).value);
              }
            }}
            placeholder={t('placeholder')}
            className="pr-10 font-mono"
            disabled={isLooking}
          />
          {isLooking && (
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
              aria-label={t('searchingAria')}
            >
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          disabled={isLooking}
          className="shrink-0 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
          title={t('scanTitle')}
          aria-label={t('scanAria')}
        >
          📷
        </button>
      </div>
      {!hideLookupHint && (
        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
          {value ? t('hintFilled') : t('hintEmpty')}
        </p>
      )}
      <CameraBarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          const clean = code.replace(/\D/g, '').slice(0, 14);
          onChange(clean);
          setScannerOpen(false);
          toast.success(t('scanned', { code }));
          runLookup(clean);
        }}
      />
    </div>
  );
}
