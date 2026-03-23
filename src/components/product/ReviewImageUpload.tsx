'use client';

import { useState, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

const MAX_IMAGES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ReviewImageUploadProps {
  onChange: (urls: string[]) => void;
  maxImages?: number;
}

interface PreviewImage {
  file: File;
  preview: string;
}

export default function ReviewImageUpload({
  onChange,
  maxImages = MAX_IMAGES,
}: ReviewImageUploadProps) {
  const [previews, setPreviews] = useState<PreviewImage[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (files: File[]): string | null => {
      const totalCount = previews.length + files.length;
      if (totalCount > maxImages) {
        return `Максимум ${maxImages} фото. Ви вже додали ${previews.length}.`;
      }
      for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          return `Непідтримуваний формат: ${file.name}. Дозволені: JPEG, PNG, WebP`;
        }
        if (file.size > MAX_SIZE) {
          return `Файл ${file.name} перевищує максимальний розмір 5MB`;
        }
      }
      return null;
    },
    [previews.length, maxImages]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      setError('');
      const validationError = validateFiles(files);
      if (validationError) {
        setError(validationError);
        return;
      }

      const newPreviews = files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

      setPreviews((prev) => [...prev, ...newPreviews]);
    },
    [validateFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addFiles(files);
  };

  const removeImage = (index: number) => {
    setPreviews((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async () => {
    if (previews.length === 0) return;

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      const formData = new FormData();
      for (const p of previews) {
        formData.append('images', p.file);
      }

      const res = await apiClient.upload<{ urls: string[] }>(
        '/api/v1/reviews/upload',
        formData
      );

      if (res.success && res.data) {
        const urls = res.data.urls;
        setUploadedUrls(urls);
        onChange(urls);
        setProgress(100);
        // Clean up previews
        for (const p of previews) {
          URL.revokeObjectURL(p.preview);
        }
        setPreviews([]);
      } else {
        setError(res.error || 'Помилка завантаження');
      }
    } catch {
      setError('Помилка завантаження зображень');
    } finally {
      setUploading(false);
    }
  };

  const remaining = maxImages - previews.length - uploadedUrls.length;

  return (
    <div className="space-y-3">
      <label className="mb-1 block text-sm font-medium">
        Фото ({uploadedUrls.length + previews.length}/{maxImages})
      </label>

      {/* Uploaded images */}
      {uploadedUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedUrls.map((url, i) => (
            <div
              key={i}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-green-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Завантажено ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-green-600"
                >
                  <path
                    d="M9 12l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Previews */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div
              key={i}
              className="group relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--color-border)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.preview}
                alt={`Попередній перегляд ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Видалити зображення ${i + 1}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {remaining > 0 && uploadedUrls.length === 0 && (
        <div
          role="button"
          tabIndex={0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
            isDragOver
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]'
              : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]'
          }`}
          data-testid="drop-zone"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="mb-2 text-[var(--color-text-secondary)]"
          >
            <path
              d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm text-[var(--color-text-secondary)]">
            Перетягніть фото сюди або натисніть для вибору
          </span>
          <span className="mt-1 text-xs text-[var(--color-text-secondary)]">
            JPEG, PNG, WebP. Макс. 5MB. Залишилось: {remaining}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-input"
      />

      {/* Upload button */}
      {previews.length > 0 && !uploading && (
        <button
          type="button"
          onClick={handleUpload}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Завантажити {previews.length}{' '}
          {previews.length === 1 ? 'фото' : 'фото'}
        </button>
      )}

      {/* Progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">Завантаження...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
