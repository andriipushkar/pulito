'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cleanPhone } from '@/components/ui/PhoneInput';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: cleanPhone(phone), subject, message, website: honeypot }),
      });

      if (res.ok) {
        toast.success('Повідомлення надіслано! Ми зв\'яжемося з вами найближчим часом.');
        setName('');
        setEmail('');
        setPhone('');
        setSubject('');
        setMessage('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Помилка при надсиланні');
      }
    } catch {
      toast.error('Помилка з\'єднання. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="text" placeholder="Ваше ім'я *" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
      <input type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
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
        className={inputClass}
      />
      <input type="text" placeholder="Тема" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
      <textarea
        placeholder="Повідомлення *"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        rows={5}
        className={inputClass}
      />
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
