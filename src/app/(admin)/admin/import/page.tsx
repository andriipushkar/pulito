'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient, getAccessToken } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import SupplierChannelsSection from '@/components/admin/SupplierChannelsSection';

interface ImportLog {
  id: number;
  filename: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  status: string;
  startedAt: string;
  rollbackedAt?: string | null;
  createdProductIds?: number[];
  updatedProductIds?: number[];
}

interface ImportRowError {
  row: number;
  code?: string;
  field: string;
  message: string;
}

interface ImportResult {
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: ImportRowError[];
}

interface PriceDiffRow {
  code: string;
  name: string | null;
  oldRetail: number | null;
  newRetail: number | null;
  oldWholesale: number | null;
  newWholesale: number | null;
  oldWholesale2: number | null;
  newWholesale2: number | null;
  oldWholesale3: number | null;
  newWholesale3: number | null;
  status: 'changed' | 'unchanged' | 'missing';
}

interface ImportPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
  format: 'standard' | 'supplier';
}

interface PricePreview {
  headers: string[];
  totalRows: number;
  changedCount: number;
  unchangedCount: number;
  missingCount: number;
  sample: PriceDiffRow[];
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const text = value === undefined || value === null ? '' : String(value);
  if (/[",\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildErrorsCsv(errors: ImportRowError[]): string {
  const header = 'Рядок;Код;Поле;Повідомлення';
  const rows = errors.map((e) => [e.row, e.code, e.field, e.message].map(escapeCsvCell).join(';'));
  // BOM so Excel opens UTF-8 correctly
  return '﻿' + [header, ...rows].join('\n');
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminImportPage() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [pricePreview, setPricePreview] = useState<PricePreview | null>(null);
  const [pricePreviewFile, setPricePreviewFile] = useState<File | null>(null);
  const [isPricePreviewing, setIsPricePreviewing] = useState(false);
  const [lastErrors, setLastErrors] = useState<ImportRowError[]>([]);
  const [downloadingLogId, setDownloadingLogId] = useState<number | null>(null);
  const [rollbackingId, setRollbackingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<null | 'products' | 'prices' | 'images'>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const priceFileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — server can keep processing

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<ImportLog[]>('/api/v1/admin/import/logs');
      if (res.success && res.data) {
        setLogs(res.data);
      } else if (!res.success) {
        toast.error(res.error || 'Не вдалося завантажити історію імпортів');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsLoading(false);
    }
  };

  const ACCEPTED_SHEET_EXTS = ['.xlsx', '.xls', '.csv', '.xml', '.yml'];

  const isAcceptedSheet = (filename: string) =>
    ACCEPTED_SHEET_EXTS.some((ext) => filename.toLowerCase().endsWith(ext));

  const handleProductFile = async (file: File) => {
    if (!isAcceptedSheet(file.name)) {
      setUploadMessage({ type: 'error', text: 'Підтримуються формати: .xlsx, .xls, .csv, .xml, .yml' });
      return;
    }

    setPreviewFile(file);
    setUploadMessage(null);
    setPreview(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/import/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPreview(data.data);
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Не вдалося прочитати файл' });
      }
    } catch {
      setUploadMessage({ type: 'error', text: 'Помилка читання файлу' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProductFile(file);
  };

  const handlePriceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePriceFile(file);
  };

  const handleDrop = (
    zone: 'products' | 'prices' | 'images',
    e: React.DragEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (zone === 'products') return void handleProductFile(file);
    if (zone === 'prices') return void handlePriceFile(file);
    if (zone === 'images') return void handleImageZipUpload(file);
  };

  const handleDragOver = (
    zone: 'products' | 'prices' | 'images',
    e: React.DragEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    if (dragOver !== zone) setDragOver(zone);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(null);
  };

  const downloadProductTemplate = async () => {
    const token = getAccessToken();
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/v1/admin/export?type=product_template&format=xlsx', {
      credentials: 'include',
      headers,
    });
    if (!res.ok) {
      setUploadMessage({ type: 'error', text: 'Не вдалося завантажити шаблон товарів' });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-template_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (opts?: { dryRun?: boolean }) => {
    if (!previewFile) return;
    const dryRun = opts?.dryRun === true;

    setIsUploading(true);
    setIsProcessing(false);
    setUploadMessage(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', previewFile);

    try {
      const xhr = new XMLHttpRequest();
      xhr.timeout = UPLOAD_TIMEOUT_MS;

      const uploadPromise = new Promise<{
        success: boolean;
        data?: ImportResult;
        error?: string;
      }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        // Once the file is fully uploaded the server starts processing; flip
        // to a determinate "processing" spinner instead of a fake progress
        // bar that keeps creeping toward 95%.
        xhr.upload.addEventListener('load', () => {
          setUploadProgress(100);
          setIsProcessing(true);
        });

        xhr.addEventListener('load', () => {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error('Invalid response'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('timeout', () => reject(new Error('Час очікування вийшов')));
        xhr.open('POST', `/api/v1/admin/import/products${dryRun ? '?dryRun=1' : ''}`);
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        const uploadToken = getAccessToken();
        if (uploadToken) xhr.setRequestHeader('Authorization', `Bearer ${uploadToken}`);
        xhr.send(formData);
      });

      const data = await uploadPromise;

      if (data.success) {
        const d = data.data;
        const errorCount = d?.errors?.length ?? 0;
        const summary = d
          ? `створено: ${d.created ?? 0}, оновлено: ${d.updated ?? 0}, пропущено: ${d.skipped ?? 0}${
              errorCount > 0 ? `, помилок: ${errorCount}` : ''
            }`
          : '0 товарів';
        const prefix = dryRun ? 'Симуляція (БД не змінено)' : 'Імпорт завершено';
        setUploadMessage({
          type: errorCount > 0 ? 'error' : 'success',
          text: `${prefix} — ${summary}`,
        });
        setLastErrors(d?.errors ?? []);
        if (!dryRun) {
          setPreview(null);
          setPreviewFile(null);
          loadLogs();
        }
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Помилка імпорту' });
        setLastErrors([]);
      }
    } catch {
      setUploadMessage({ type: 'error', text: 'Помилка завантаження файлу' });
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageZipUpload = async (
    fileOrEvent: File | React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      fileOrEvent instanceof File ? fileOrEvent : fileOrEvent.target.files?.[0] ?? null;
    if (!file) return;

    setIsUploading(true);
    setIsProcessing(false);
    setUploadMessage(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.timeout = UPLOAD_TIMEOUT_MS;

      const data = await new Promise<{
        success: boolean;
        data?: { processedCount?: number; skippedCount?: number };
        error?: string;
      }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.upload.addEventListener('load', () => {
          setUploadProgress(100);
          setIsProcessing(true);
        });
        xhr.addEventListener('load', () => {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid response'));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('timeout', () => reject(new Error('Час очікування вийшов')));
        xhr.open('POST', '/api/v1/admin/import/images');
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        const imgToken = getAccessToken();
        if (imgToken) xhr.setRequestHeader('Authorization', `Bearer ${imgToken}`);
        xhr.send(formData);
      });

      if (data.success) {
        setUploadMessage({
          type: 'success',
          text: `Завантажено ${data.data?.processedCount || 0} зображень`,
        });
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Помилка завантаження зображень' });
      }
    } catch {
      setUploadMessage({ type: 'error', text: 'Помилка завантаження' });
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (!(fileOrEvent instanceof File)) {
        fileOrEvent.target.value = '';
      }
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    setPreviewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadLastErrorsCsv = () => {
    if (lastErrors.length === 0) return;
    downloadCsv(
      `import-errors-${new Date().toISOString().slice(0, 10)}.csv`,
      buildErrorsCsv(lastErrors),
    );
  };

  const handleRollback = async (log: ImportLog) => {
    const counts = `~${log.createdCount} нових товарів і ~${log.updatedCount} оновлених цін`;
    if (!confirm(
      `Скасувати імпорт "${log.filename}"?\n\nБуде:\n• Soft-видалено ${counts}\n• Повернуто старі ціни з PriceHistory\n\nКіл-ть, описи, фото — НЕ скасовуються (їх немає в історії).\nЦю дію неможливо повторно скасувати.`,
    )) return;

    setRollbackingId(log.id);
    try {
      const res = await apiClient.post<{ softDeletedCount: number; pricesRevertedCount: number }>(
        `/api/v1/admin/import/logs/${log.id}/rollback`,
      );
      if (res.success && res.data) {
        toast.success(
          `Скасовано: ${res.data.softDeletedCount} товарів видалено, ${res.data.pricesRevertedCount} цін повернуто`,
        );
        loadLogs();
      } else {
        toast.error(res.error || 'Не вдалося скасувати імпорт');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setRollbackingId(null);
    }
  };

  const downloadLogErrorsCsv = async (log: ImportLog) => {
    if (log.errorCount === 0) return;
    setDownloadingLogId(log.id);
    try {
      const res = await apiClient.get<{ errorsJson?: ImportRowError[]; filename: string }>(
        `/api/v1/admin/import/logs/${log.id}`,
      );
      const errors = res.data?.errorsJson ?? [];
      if (errors.length === 0) return;
      downloadCsv(`import-errors-${log.id}.csv`, buildErrorsCsv(errors));
    } finally {
      setDownloadingLogId(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handlePriceFile = async (file: File) => {
    if (!isAcceptedSheet(file.name)) {
      setUploadMessage({ type: 'error', text: 'Підтримуються формати: .xlsx, .xls, .csv, .xml, .yml' });
      return;
    }

    setPricePreviewFile(file);
    setUploadMessage(null);
    setPricePreview(null);
    setIsPricePreviewing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/admin/import/prices/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPricePreview(data.data);
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Не вдалося прочитати файл' });
        setPricePreviewFile(null);
      }
    } catch {
      setUploadMessage({ type: 'error', text: 'Помилка читання файлу' });
      setPricePreviewFile(null);
    } finally {
      setIsPricePreviewing(false);
    }
  };

  const handlePriceUpload = async () => {
    if (!pricePreviewFile) return;
    setIsUploading(true);
    setIsProcessing(false);
    setUploadMessage(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', pricePreviewFile);

    try {
      const xhr = new XMLHttpRequest();
      xhr.timeout = UPLOAD_TIMEOUT_MS;

      const data = await new Promise<{ success: boolean; data?: ImportResult; error?: string }>(
        (resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
          xhr.upload.addEventListener('load', () => {
            setUploadProgress(100);
            setIsProcessing(true);
          });
          xhr.addEventListener('load', () => {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid response'));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          xhr.addEventListener('timeout', () => reject(new Error('Час очікування вийшов')));
          xhr.open('POST', '/api/v1/admin/import/prices');
          xhr.withCredentials = true;
          xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
          const token = getAccessToken();
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        },
      );

      if (data.success) {
        const d = data.data as ImportResult;
        const errorCount = d?.errors?.length ?? 0;
        setUploadMessage({
          type: errorCount > 0 ? 'error' : 'success',
          text: `Ціни оновлено — оновлено: ${d.updated ?? 0}, пропущено: ${d.skipped ?? 0}${errorCount > 0 ? `, помилок: ${errorCount}` : ''}`,
        });
        setLastErrors(d?.errors ?? []);
        setPricePreview(null);
        setPricePreviewFile(null);
        loadLogs();
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Помилка імпорту' });
        setLastErrors([]);
      }
    } catch {
      setUploadMessage({ type: 'error', text: 'Помилка завантаження файлу' });
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      if (priceFileInputRef.current) priceFileInputRef.current.value = '';
    }
  };

  const cancelPricePreview = () => {
    setPricePreview(null);
    setPricePreviewFile(null);
    if (priceFileInputRef.current) priceFileInputRef.current.value = '';
  };

  const downloadPriceTemplate = async () => {
    const token = getAccessToken();
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/v1/admin/export?type=price_template&format=xlsx', {
      credentials: 'include',
      headers,
    });
    if (!res.ok) {
      setUploadMessage({ type: 'error', text: 'Не вдалося завантажити шаблон цін' });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-template_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const fmtPrice = (v: number | null) =>
    v === null ? '—' : v.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pctDelta = (oldV: number | null, newV: number | null) => {
    if (oldV === null || newV === null || oldV === 0) return null;
    return Math.round(((newV - oldV) / oldV) * 1000) / 10;
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Імпорт товарів</h2>

      {/* Upload section */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          onDragOver={(e) => handleDragOver('products', e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop('products', e)}
          className={`rounded-[var(--radius)] border-2 border-dashed bg-[var(--color-bg)] p-6 transition-colors ${
            dragOver === 'products'
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
              : 'border-[var(--color-border)]'
          }`}
        >
          <h3 className="mb-3 text-sm font-semibold">Повний прайс-лист</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Створює та оновлює товари. Колонки: код, <strong>штрихкод</strong> (EAN/UPC), назва,
            категорія, ціни, опис, SEO. Підтримує формат постачальника (без коду — категорії з
            рядків-роздільників). Штрихкод використовується для дедуплікації між форматами.
          </p>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Перетягніть файл сюди або
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-block">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.xml,.yml"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]">
                {isUploading ? 'Завантаження...' : 'Обрати файл'}
              </span>
            </label>
            <button
              type="button"
              onClick={downloadProductTemplate}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
            >
              Шаблон (xlsx)
            </button>
          </div>
        </div>

        <div
          onDragOver={(e) => handleDragOver('prices', e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop('prices', e)}
          className={`rounded-[var(--radius)] border-2 border-dashed p-6 transition-colors ${
            dragOver === 'prices' ? 'border-blue-600 bg-blue-50' : 'border-blue-300 bg-blue-50/40'
          }`}
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            Швидке оновлення цін
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Рекомендовано
            </span>
          </h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Файл з колонками <code>Код</code> + ціни. Оновлюються тільки ціни існуючих товарів — без
            створення нових. Перед застосуванням покажемо diff (старі → нові).
          </p>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Перетягніть файл сюди або
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-block">
              <input
                ref={priceFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.xml,.yml"
                onChange={handlePriceFileSelect}
                disabled={isUploading || isPricePreviewing}
                className="hidden"
              />
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                {isPricePreviewing ? 'Аналіз...' : 'Обрати файл'}
              </span>
            </label>
            <button
              type="button"
              onClick={downloadPriceTemplate}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
            >
              Шаблон (xlsx)
            </button>
          </div>
        </div>

        <div
          onDragOver={(e) => handleDragOver('images', e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop('images', e)}
          className={`rounded-[var(--radius)] border-2 border-dashed bg-[var(--color-bg)] p-6 transition-colors ${
            dragOver === 'images'
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
              : 'border-[var(--color-border)]'
          }`}
        >
          <h3 className="mb-3 text-sm font-semibold">Завантажити зображення</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Одне зображення або ZIP-архів. Назва файлу = код товару (наприклад{' '}
            <code>ABC123.jpg</code>) або штрихкод EAN/UPC з 8–14 цифр (наприклад{' '}
            <code>4820001234567.jpg</code>). Існуючі фото товару замінюються.
          </p>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Перетягніть файл сюди або
          </p>
          <label className="inline-block">
            <input
              ref={imageInputRef}
              type="file"
              accept=".zip,.jpg,.jpeg,.png,.webp"
              onChange={handleImageZipUpload}
              disabled={isUploading}
              className="hidden"
            />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)]">
              Обрати файл
            </span>
          </label>
        </div>
      </div>

      {/* Progress bar — first shows upload %, then flips to indeterminate
          "processing" once the file has reached the server. */}
      {isUploading && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
            <span>
              {isProcessing
                ? 'Обробка на сервері…'
                : `Завантаження файлу — ${uploadProgress}%`}
            </span>
            {!isProcessing && <span>{uploadProgress}%</span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className={`h-full rounded-full bg-[var(--color-primary)] ${
                isProcessing ? 'animate-pulse' : 'transition-all duration-300'
              }`}
              style={{ width: isProcessing ? '100%' : `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadMessage && (
        <div
          className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}
        >
          {uploadMessage.text}
        </div>
      )}

      {lastErrors.length > 0 && (
        <div className="mb-6 rounded-[var(--radius)] border border-red-200 bg-red-50/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-danger)]">
              Знайдено {lastErrors.length} помилок у файлі
            </h3>
            <Button size="sm" variant="outline" onClick={downloadLastErrorsCsv}>
              Завантажити CSV
            </Button>
          </div>
          <div className="max-h-60 overflow-auto rounded border border-red-200 bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-red-50 text-red-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Рядок</th>
                  <th className="px-3 py-2 text-left font-medium">Код</th>
                  <th className="px-3 py-2 text-left font-medium">Поле</th>
                  <th className="px-3 py-2 text-left font-medium">Помилка</th>
                </tr>
              </thead>
              <tbody>
                {lastErrors.slice(0, 100).map((err, i) => (
                  <tr key={i} className="border-t border-red-100">
                    <td className="px-3 py-1.5">{err.row}</td>
                    <td className="px-3 py-1.5 font-mono text-[var(--color-text-secondary)]">
                      {err.code || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">{err.field}</td>
                    <td className="px-3 py-1.5">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lastErrors.length > 100 && (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Показано перші 100 з {lastErrors.length}. Завантажте CSV для повного списку.
            </p>
          )}
        </div>
      )}

      {/* Price-only preview (diff) */}
      {pricePreview && (
        <div className="mb-6 rounded-[var(--radius)] border-2 border-blue-200 bg-blue-50/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">
                Diff цін
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Тільки ціни
                </span>
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {pricePreviewFile?.name} — {pricePreview.totalRows} рядків · нові товари не
                створюються
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePriceUpload} isLoading={isUploading}>
                Застосувати оновлення
              </Button>
              <Button size="sm" variant="outline" onClick={cancelPricePreview}>
                Скасувати
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">
              Зміняться: {pricePreview.changedCount}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
              Без змін: {pricePreview.unchangedCount}
            </span>
            {pricePreview.missingCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-700">
                Не знайдено: {pricePreview.missingCount}
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-auto rounded border border-[var(--color-border)] bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Код</th>
                  <th className="px-3 py-2 text-left font-medium">Назва</th>
                  <th className="px-3 py-2 text-right font-medium">Роздріб</th>
                  <th className="px-3 py-2 text-right font-medium">Опт</th>
                  <th className="px-3 py-2 text-right font-medium">Опт 2</th>
                  <th className="px-3 py-2 text-right font-medium">Опт 3</th>
                  <th className="px-3 py-2 text-center font-medium">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {pricePreview.sample.map((d, i) => {
                  const delta = pctDelta(d.oldRetail, d.newRetail);
                  return (
                    <tr
                      key={i}
                      className={`border-t border-[var(--color-border)] ${
                        d.status === 'missing'
                          ? 'bg-red-50/40'
                          : d.status === 'changed'
                            ? 'bg-green-50/40'
                            : ''
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono">{d.code}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                        {d.status === 'missing' ? (
                          <span className="text-red-600">не знайдено</span>
                        ) : (
                          d.name
                        )}
                      </td>
                      {(
                        [
                          ['oldRetail', 'newRetail'],
                          ['oldWholesale', 'newWholesale'],
                          ['oldWholesale2', 'newWholesale2'],
                          ['oldWholesale3', 'newWholesale3'],
                        ] as const
                      ).map(([oldKey, newKey], ci) => {
                        const oldV = d[oldKey];
                        const newV = d[newKey];
                        const changed = newV !== null && oldV !== newV;
                        return (
                          <td key={ci} className="px-3 py-1.5 text-right">
                            {changed ? (
                              <span>
                                <span className="text-[var(--color-text-secondary)] line-through">
                                  {fmtPrice(oldV)}
                                </span>{' '}
                                <span className="font-medium text-green-700">
                                  {fmtPrice(newV)}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-secondary)]">
                                {fmtPrice(oldV ?? newV)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-center">
                        {delta !== null && delta !== 0 ? (
                          <span className={delta > 0 ? 'text-red-600' : 'text-green-700'}>
                            {delta > 0 ? '+' : ''}
                            {delta}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pricePreview.totalRows > pricePreview.sample.length && (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Показано перші {pricePreview.sample.length} з {pricePreview.totalRows} рядків
            </p>
          )}
        </div>
      )}

      {/* Standard preview */}
      {preview && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">
                Попередній перегляд
                {preview.format === 'supplier' && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Формат постачальника
                  </span>
                )}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {previewFile?.name} — {preview.totalRows} рядків
                {preview.format === 'supplier' && ' (категорії з рядків-роздільників)'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpload({ dryRun: true })}
                isLoading={isUploading}
                title="Симуляція: пройти валідацію + порахувати скільки створити/оновити, БЕЗ запису в БД"
              >
                Перевірити (dry-run)
              </Button>
              <Button size="sm" onClick={() => handleUpload()} isLoading={isUploading}>
                Імпортувати
              </Button>
              <Button size="sm" variant="outline" onClick={cancelPreview}>
                Скасувати
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto rounded border border-[var(--color-border)]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 10).map((row, ri) => (
                  <tr key={ri} className="border-t border-[var(--color-border)]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 10 && (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Показано перші 10 з {preview.totalRows} рядків
            </p>
          )}
        </div>
      )}

      {/* Supplier channels — pull feeds from URLs */}
      <SupplierChannelsSection />

      {/* History */}
      <h3 className="mb-3 text-sm font-semibold">Історія імпортів</h3>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">Файл</th>
                <th className="px-4 py-3 text-center font-medium">Рядків</th>
                <th className="px-4 py-3 text-center font-medium">Створено</th>
                <th className="px-4 py-3 text-center font-medium">Оновлено</th>
                <th className="px-4 py-3 text-center font-medium">Помилки</th>
                <th className="px-4 py-3 text-center font-medium">Статус</th>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="px-4 py-3 text-center font-medium">Дії</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3">{log.filename}</td>
                  <td className="px-4 py-3 text-center">{log.totalRows ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-green-600">{log.createdCount ?? 0}</td>
                  <td className="px-4 py-3 text-center text-blue-600">{log.updatedCount ?? 0}</td>
                  <td className="px-4 py-3 text-center text-[var(--color-danger)]">
                    {log.errorCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        log.status.startsWith('completed')
                          ? 'bg-green-100 text-green-700'
                          : log.status.startsWith('failed')
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {log.status.startsWith('completed')
                        ? 'Завершено'
                        : log.status.startsWith('failed')
                          ? 'Помилка'
                          : 'В процесі'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {formatDate(log.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {log.errorCount > 0 && (
                        <button
                          type="button"
                          onClick={() => downloadLogErrorsCsv(log)}
                          disabled={downloadingLogId === log.id}
                          className="text-xs text-[var(--color-primary)] underline disabled:opacity-50"
                        >
                          {downloadingLogId === log.id ? '…' : 'CSV помилок'}
                        </button>
                      )}
                      {log.status.startsWith('completed') && !log.rollbackedAt && (
                        <button
                          type="button"
                          onClick={() => handleRollback(log)}
                          disabled={rollbackingId === log.id}
                          title="Скасувати імпорт: повернути старі ціни, видалити нові товари"
                          className="text-xs text-[var(--color-danger)] underline disabled:opacity-50"
                        >
                          {rollbackingId === log.id ? '…' : 'Скасувати'}
                        </button>
                      )}
                      {log.rollbackedAt && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          скасовано
                        </span>
                      )}
                      {log.errorCount === 0 && log.status.startsWith('completed') && !log.rollbackedAt ? null : null}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                      <span className="text-3xl" aria-hidden="true">
                        📥
                      </span>
                      <p className="text-sm font-medium">Імпортів ще не було</p>
                      <p className="text-xs">
                        Завантажте перший прайс-лист — історія імпортів буде тут
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
