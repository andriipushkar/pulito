'use client';

import { Link } from '@/i18n/navigation';
import { useId, useState } from 'react';

interface SubscriptionFormProps {
  variant?: 'dark' | 'light';
}

export default function SubscriptionForm({ variant = 'dark' }: SubscriptionFormProps) {
  const consentId = useId();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !consent) return;

    if (honeypot) {
      setStatus('success');
      setEmail('');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/v1/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
        setConsent(false);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const isLight = variant === 'light';
  const inputClass = isLight
    ? 'flex-1 rounded-[var(--radius)] border border-white/30 bg-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/60 backdrop-blur focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40'
    : 'flex-1 rounded-[var(--radius)] border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-300 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30';
  const buttonClass = isLight
    ? 'shrink-0 rounded-[var(--radius)] bg-white px-5 py-2.5 text-sm font-bold text-[var(--color-primary-dark)] shadow-sm transition-colors hover:bg-white/90 disabled:opacity-50'
    : 'shrink-0 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-light)] disabled:opacity-50';
  const consentClass = isLight ? 'text-[11px] text-white/80' : 'text-[11px] text-white/55';
  const linkClass = isLight
    ? 'underline-offset-2 hover:underline'
    : 'text-white/80 underline-offset-2 hover:text-white hover:underline';

  if (status === 'success') {
    return (
      <p
        className={
          isLight
            ? 'rounded-[var(--radius)] bg-white/15 px-3 py-2.5 text-sm font-medium text-white'
            : 'text-sm text-[var(--color-success)]'
        }
      >
        Дякуємо за підписку!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="text"
        name="company_url"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: 0,
          height: 0,
          overflow: 'hidden',
        }}
      />
      <div className="flex gap-2">
        <label htmlFor={`${consentId}-email`} className="sr-only">
          Email для підписки
        </label>
        <input
          id={`${consentId}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ваш email"
          required
          className={inputClass}
        />
        <button type="submit" disabled={status === 'loading' || !consent} className={buttonClass}>
          {status === 'loading' ? '...' : isLight ? 'Підписатись' : 'OK'}
        </button>
      </div>
      <label htmlFor={consentId} className={`flex items-start gap-2 ${consentClass}`}>
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/40 bg-white/10 accent-[var(--color-primary)]"
        />
        <span>
          Погоджуюсь з{' '}
          <Link href="/pages/privacy-policy" className={linkClass}>
            політикою конфіденційності
          </Link>
        </span>
      </label>
      {status === 'error' && (
        <p className="text-[11px] text-rose-300">Помилка. Спробуйте ще раз.</p>
      )}
    </form>
  );
}
