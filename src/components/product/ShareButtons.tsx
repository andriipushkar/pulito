'use client';

import { useState, useEffect } from 'react';
import { Copy, Facebook, Telegram, Viber, Instagram, Check } from '@/components/icons';

interface ShareButtonsProps {
  url: string;
  title: string;
}

export default function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState('');

  useEffect(() => {
    setFullUrl(`${window.location.origin}${url}`);
  }, [url]);

  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  if (!fullUrl) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const btnClass =
    'flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-95';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-text-secondary)]">Поділитись:</span>
      <button onClick={handleCopy} className={btnClass} aria-label="Копіювати посилання" title="Копіювати посилання">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <a
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className={btnClass}
        aria-label="Telegram"
      >
        <Telegram size={16} />
      </a>
      <a
        href={`viber://forward?text=${encodedTitle}%20${encodedUrl}`}
        className={btnClass}
        aria-label="Viber"
      >
        <Viber size={16} />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={btnClass}
        aria-label="Facebook"
      >
        <Facebook size={16} />
      </a>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(fullUrl);
            setIgCopied(true);
            setTimeout(() => setIgCopied(false), 3000);
          } catch {}
        }}
        className={btnClass}
        aria-label="Instagram"
        title={igCopied ? 'Посилання скопійовано — вставте в Stories' : 'Instagram Stories'}
      >
        {igCopied ? <Check size={16} /> : <Instagram size={16} />}
      </button>
    </div>
  );
}
