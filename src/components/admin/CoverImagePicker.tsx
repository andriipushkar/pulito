'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface ProductHit {
  id: number;
  name: string;
  slug: string;
  code: string | null;
  imagePath: string | null;
}

interface CoverImagePickerProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
}

type Mode = 'upload' | 'product';

/**
 * Cover-image picker for the blog editor: upload a file or pick an existing
 * product's photo, instead of pasting a raw URL. Both paths resolve to the
 * same `/uploads/...` string stored in coverImage — the upload endpoint and
 * product.imagePath already live there.
 */
export default function CoverImagePicker({ label, value, onChange }: CoverImagePickerProps) {
  const t = useTranslations('admin.coverImagePicker');
  const [mode, setMode] = useState<Mode>('upload');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced product search; min 2 chars so a single keystroke doesn't spam
  // the catalog endpoint.
  useEffect(() => {
    if (mode !== 'product') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      apiClient
        .get<ProductHit[]>(`/api/v1/admin/products?search=${encodeURIComponent(q)}&limit=8`)
        .then((res) => {
          if (cancelled) return;
          if (res.success && res.data) setResults(res.data);
          else {
            setResults([]);
            toast.error(res.error || t('searchError'));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            toast.error(t('searchError'));
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode, t]);

  const handleFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'publications');
    try {
      const res = await fetch('/api/v1/admin/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const data = await res.json();
      if (data?.success && data.data?.path) onChange(data.data.path as string);
      else toast.error(data?.error || t('uploadError'));
    } catch {
      toast.error(t('uploadError'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const tabClass = (active: boolean) =>
    `rounded-[calc(var(--radius)-2px)] px-3 py-1 transition-colors ${
      active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'
    }`;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>

      {value && (
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-white">
            <Image src={value} alt="" fill sizes="112px" className="object-contain" />
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-[var(--color-danger)] hover:underline"
          >
            {t('remove')}
          </button>
        </div>
      )}

      <div className="mb-3 inline-flex rounded-[var(--radius)] border border-[var(--color-border)] p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={tabClass(mode === 'upload')}
        >
          {t('uploadTab')}
        </button>
        <button
          type="button"
          onClick={() => setMode('product')}
          className={tabClass(mode === 'product')}
        >
          {t('productTab')}
        </button>
      </div>

      {mode === 'upload' ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:opacity-90 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {uploading ? t('uploading') : t('uploadHint')}
          </p>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPh')}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          {query.trim().length >= 2 && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)]">
              {searching && results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                  {t('searching')}
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                  {t('noResults')}
                </p>
              ) : (
                results.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => p.imagePath && onChange(p.imagePath)}
                    disabled={!p.imagePath}
                    title={p.imagePath ? undefined : t('noPhoto')}
                    className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-left last:border-0 hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-[var(--color-border)] bg-white">
                      {p.imagePath && (
                        <Image
                          src={p.imagePath}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-contain"
                        />
                      )}
                    </div>
                    <span className="flex-1 truncate text-sm">{p.name}</span>
                    {p.code && (
                      <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                        {p.code}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
