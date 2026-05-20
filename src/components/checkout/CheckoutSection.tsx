'use client';

import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import { Check } from '@/components/icons';

interface CheckoutSectionProps {
  step: number;
  title: string;
  /** Summary rendered when the section is collapsed (after the user has completed it). */
  summary?: ReactNode;
  expanded: boolean;
  completed: boolean;
  /** Click handler for the section header / "Змінити" link. */
  onEdit: () => void;
  /** Click handler for the inline "Продовжити" button. Omit for the last section. */
  onContinue?: () => void;
  /** Disables continue (e.g., during async submit). */
  continueDisabled?: boolean;
  /** Label override for continue button. */
  continueLabel?: string;
  children: ReactNode;
}

export default function CheckoutSection({
  step,
  title,
  summary,
  expanded,
  completed,
  onEdit,
  onContinue,
  continueDisabled,
  continueLabel = 'Продовжити',
  children,
}: CheckoutSectionProps) {
  return (
    <section
      aria-expanded={expanded}
      className={`rounded-[var(--radius)] border bg-[var(--color-bg)] transition-colors ${
        expanded
          ? 'border-[var(--color-primary)]'
          : completed
            ? 'border-[var(--color-border)]'
            : 'border-[var(--color-border)] opacity-60'
      }`}
    >
      <header
        className={`flex items-center gap-3 px-5 py-4 ${
          !expanded && completed ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)]' : ''
        }`}
        onClick={() => {
          if (!expanded && completed) onEdit();
        }}
      >
        <div
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            completed
              ? 'bg-emerald-500 text-white'
              : expanded
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
          }`}
        >
          {completed ? <Check size={14} /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {!expanded && summary && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
              {summary}
            </p>
          )}
        </div>
        {!expanded && completed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="shrink-0 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            Змінити
          </button>
        )}
      </header>
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-5 py-5">
          {children}
          {onContinue && (
            <div className="mt-5 flex justify-end">
              <Button
                onClick={onContinue}
                disabled={continueDisabled}
                className="w-full sm:w-auto"
              >
                {continueLabel}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
