'use client';

import { useState } from 'react';
import { Phone, Close } from '@/components/icons';
import { cleanPhone } from '@/components/ui/PhoneInput';

export default function CallbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const message = preferredTime
        ? `Запит на зворотний дзвінок. Зручний час: ${preferredTime}`
        : 'Запит на зворотний дзвінок';

      const res = await fetch('/api/v1/callback-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: cleanPhone(phone), message, website: honeypot }),
      });

      if (res.ok) {
        setStatus('success');
        setName('');
        setPhone('');
        setPreferredTime('');
        setTimeout(() => {
          setIsOpen(false);
          setStatus('idle');
        }, 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const inputClass =
    'rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-lg transition-transform hover:scale-110"
        aria-label="Замовити дзвінок"
      >
        <Phone size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[var(--color-bg-overlay)]" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-sm animate-fade-in-up rounded-[var(--radius)] bg-[var(--color-bg)] p-6 shadow-xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              aria-label="Закрити"
            >
              <Close size={20} />
            </button>

            <h3 className="mb-1 text-lg font-bold">Замовити дзвінок</h3>
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
              Залиште свої дані і ми зателефонуємо вам
            </p>

            {status === 'success' ? (
              <div className="rounded-[var(--radius)] bg-green-50 p-4 text-center text-sm text-green-700">
                Дякуємо! Ми зв&apos;яжемося з вами найближчим часом.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Ваше ім'я"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputClass}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="+38 (0XX) XXX-XX-XX"
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    let d = digits;
                    if (d.startsWith('380')) d = '0' + d.slice(3);
                    else if (d.startsWith('38')) d = d.slice(2);
                    if (d.length > 0 && d[0] !== '0') d = '0' + d;
                    d = d.slice(0, 10);
                    if (!d) { setPhone(''); return; }
                    let fmt = `+38 (${d.slice(0, 3)}`;
                    if (d.length > 3) fmt += `) ${d.slice(3, 6)}`;
                    if (d.length > 6) fmt += `-${d.slice(6, 8)}`;
                    if (d.length > 8) fmt += `-${d.slice(8)}`;
                    setPhone(fmt);
                  }}
                  required
                  className={inputClass}
                />
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Зручний час дзвінка</option>
                  <option value="9:00-12:00">9:00 - 12:00</option>
                  <option value="12:00-15:00">12:00 - 15:00</option>
                  <option value="15:00-18:00">15:00 - 18:00</option>
                  <option value="Будь-який">Будь-який час</option>
                </select>
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                />
                {status === 'error' && (
                  <p className="text-xs text-[var(--color-danger)]">Помилка. Спробуйте ще раз.</p>
                )}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="min-h-[44px] rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {status === 'loading' ? 'Надсилання...' : 'Зателефонуйте мені'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
