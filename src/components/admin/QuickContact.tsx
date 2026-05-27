'use client';

import { useState, useRef, useEffect } from 'react';

interface QuickContactProps {
  phone: string | null | undefined;
  email?: string | null;
  /** Display label inside the trigger button. Defaults to the phone itself. */
  label?: string;
}

function normalizePhone(raw: string): string {
  // Strip everything except digits and +; force +380 for bare UA numbers so
  // tel: / viber: / wa.me: links work universally.
  let s = raw.replace(/[^\d+]/g, '');
  if (s.startsWith('0') && s.length === 10) s = `+38${s}`;
  else if (s.startsWith('380')) s = `+${s}`;
  else if (!s.startsWith('+')) s = `+${s}`;
  return s;
}

/**
 * One-click contact menu — opens a popover with links to Phone / Viber /
 * Telegram / WhatsApp for the given phone, plus an email link when present.
 * Replaces the bare phone-number text so the manager doesn't copy-paste into
 * each messenger separately.
 */
export default function QuickContact({ phone, email, label }: QuickContactProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  if (!phone && !email) return null;

  const normalized = phone ? normalizePhone(phone) : null;
  // Viber link: viber://chat?number=+380... (must include +).
  // Telegram doesn't support phone-based deep links reliably; use a search URL
  // that opens Telegram web/app and the user starts a chat from there.
  // WhatsApp wa.me requires no + (digits only).
  const waDigits = normalized?.replace(/\D/g, '');

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 rounded text-sm text-[var(--color-primary)] hover:underline"
        title="Швидко зв'язатись"
      >
        📞 <span>{label ?? phone ?? email}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
          {normalized && (
            <a
              href={`tel:${normalized}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
              onClick={() => setOpen(false)}
            >
              📞 <span>Подзвонити</span>
              <span className="ml-auto text-xs text-[var(--color-text-secondary)]">
                {normalized}
              </span>
            </a>
          )}
          {normalized && (
            <a
              href={`viber://chat?number=${encodeURIComponent(normalized)}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
              onClick={() => setOpen(false)}
            >
              💜 <span>Viber</span>
            </a>
          )}
          {normalized && (
            <a
              href={`https://t.me/${normalized.replace('+', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
              onClick={() => setOpen(false)}
            >
              ✈️ <span>Telegram</span>
            </a>
          )}
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
              onClick={() => setOpen(false)}
            >
              💬 <span>WhatsApp</span>
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg-secondary)]"
              onClick={() => setOpen(false)}
            >
              ✉️ <span>Email</span>
              <span className="ml-auto truncate text-xs text-[var(--color-text-secondary)]">
                {email}
              </span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
