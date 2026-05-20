'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cleanPhone } from '@/components/ui/PhoneInput';

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'subject' | 'message', string>>;

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = "Ім'я має містити мінімум 2 символи";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Невірний формат email';
    const cleaned = cleanPhone(phone);
    if (cleaned && !/^\+380\d{9}$/.test(cleaned)) {
      next.phone = 'Невірний формат телефону (+380...)';
    }
    if (subject.length > 200) next.subject = 'Максимум 200 символів';
    const msgLen = message.trim().length;
    if (msgLen < 10) next.message = 'Повідомлення має містити мінімум 10 символів';
    else if (msgLen > 2000) next.message = 'Максимум 2000 символів';
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: cleanPhone(phone),
          subject: subject.trim(),
          message: message.trim(),
          website: honeypot,
        }),
      });

      if (res.ok) {
        toast.success("Повідомлення надіслано! Ми зв'яжемося з вами найближчим часом.");
        setName('');
        setEmail('');
        setPhone('');
        setSubject('');
        setMessage('');
      } else if (res.status === 429) {
        toast.error('Забагато запитів. Спробуйте трохи пізніше.');
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Помилка при надсиланні');
      }
    } catch {
      toast.error("Помилка з'єднання. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'rounded-[var(--radius)] border bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]';
  const inputClass = (hasError: boolean) =>
    `${inputBase} ${hasError ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}`;

  const clearError = (field: keyof FieldErrors) => () => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div>
        <input
          type="text"
          placeholder="Ваше ім'я *"
          aria-label="Ваше ім'я"
          aria-invalid={!!errors.name}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError('name')();
          }}
          required
          className={inputClass(!!errors.name)}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name}</p>
        )}
      </div>
      <div>
        <input
          type="email"
          placeholder="Email *"
          aria-label="Email"
          aria-invalid={!!errors.email}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('email')();
          }}
          required
          className={inputClass(!!errors.email)}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email}</p>
        )}
      </div>
      <div>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="+38 (0XX) XXX-XX-XX"
          aria-label="Номер телефону"
          aria-invalid={!!errors.phone}
          value={phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            let d = digits;
            if (d.startsWith('380')) d = '0' + d.slice(3);
            else if (d.startsWith('38')) d = d.slice(2);
            if (d.length > 0 && d[0] !== '0') d = '0' + d;
            d = d.slice(0, 10);
            if (!d) {
              setPhone('');
              clearError('phone')();
              return;
            }
            let fmt = `+38 (${d.slice(0, 3)}`;
            if (d.length > 3) fmt += `) ${d.slice(3, 6)}`;
            if (d.length > 6) fmt += `-${d.slice(6, 8)}`;
            if (d.length > 8) fmt += `-${d.slice(8)}`;
            setPhone(fmt);
            clearError('phone')();
          }}
          className={inputClass(!!errors.phone)}
        />
        {errors.phone && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.phone}</p>
        )}
      </div>
      <div>
        <input
          type="text"
          placeholder="Тема"
          aria-label="Тема повідомлення"
          aria-invalid={!!errors.subject}
          value={subject}
          maxLength={200}
          onChange={(e) => {
            setSubject(e.target.value);
            clearError('subject')();
          }}
          className={inputClass(!!errors.subject)}
        />
        {errors.subject && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.subject}</p>
        )}
      </div>
      <div>
        <textarea
          placeholder="Повідомлення *"
          aria-label="Повідомлення"
          aria-invalid={!!errors.message}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            clearError('message')();
          }}
          required
          rows={5}
          maxLength={2000}
          className={inputClass(!!errors.message)}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.message ? (
            <p className="text-xs text-[var(--color-danger)]">{errors.message}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-[var(--color-text-secondary)]">{message.length}/2000</span>
        </div>
      </div>
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
      <button
        type="submit"
        disabled={loading}
        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
      >
        {loading ? 'Надсилання...' : 'Надіслати'}
      </button>
    </form>
  );
}
