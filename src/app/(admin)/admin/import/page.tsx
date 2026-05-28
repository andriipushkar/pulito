'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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

function buildErrorsCsv(errors: ImportRowError[], header: string): string {
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
  const t = useTranslations('admin.importPage');
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
        toast.error(res.error || t('loadLogsError'));
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const ACCEPTED_SHEET_EXTS = ['.xlsx', '.xls', '.csv', '.xml', '.yml'];

  const isAcceptedSheet = (filename: string) =>
    ACCEPTED_SHEET_EXTS.some((ext) => filename.toLowerCase().endsWith(ext));

  const handleProductFile = async (file: File) => {
    if (!isAcceptedSheet(file.name)) {
      setUploadMessage({ type: 'error', text: t('formatsSupported') });
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
        setUploadMessage({ type: 'error', text: data.error || t('readFileError') });
      }
    } catch {
      setUploadMessage({ type: 'error', text: t('fileReadError') });
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
      setUploadMessage({ type: 'error', text: t('templateProductError') });
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
          ? t('summaryBase', {
              created: d.created ?? 0,
              updated: d.updated ?? 0,
              skipped: d.skipped ?? 0,
            }) + (errorCount > 0 ? t('summaryErrorsSuffix', { errors: errorCount }) : '')
          : t('summaryZero');
        const prefix = dryRun ? t('prefixDryRun') : t('prefixDone');
        setUploadMessage({
          type: errorCount > 0 ? 'error' : 'success',
          text: t('resultLine', { prefix, summary }),
        });
        setLastErrors(d?.errors ?? []);
        if (!dryRun) {
          setPreview(null);
          setPreviewFile(null);
          loadLogs();
        }
      } else {
        setUploadMessage({ type: 'error', text: data.error || t('importError') });
        setLastErrors([]);
      }
    } catch {
      setUploadMessage({ type: 'error', text: t('uploadFileError') });
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageZipUpload = async (fileOrEvent: File | React.ChangeEvent<HTMLInputElement>) => {
    const file =
      fileOrEvent instanceof File ? fileOrEvent : (fileOrEvent.target.files?.[0] ?? null);
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
          text: t('imagesUploaded', { count: data.data?.processedCount || 0 }),
        });
      } else {
        setUploadMessage({ type: 'error', text: data.error || t('imagesError') });
      }
    } catch {
      setUploadMessage({ type: 'error', text: t('uploadError') });
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
      buildErrorsCsv(lastErrors, t('csvErrorHeader')),
    );
  };

  const handleRollback = async (log: ImportLog) => {
    const counts = t('rollbackCounts', { created: log.createdCount, updated: log.updatedCount });
    if (!confirm(t('rollbackConfirm', { filename: log.filename, counts }))) return;

    setRollbackingId(log.id);
    try {
      const res = await apiClient.post<{ softDeletedCount: number; pricesRevertedCount: number }>(
        `/api/v1/admin/import/logs/${log.id}/rollback`,
      );
      if (res.success && res.data) {
        toast.success(
          t('rollbackDone', {
            deleted: res.data.softDeletedCount,
            reverted: res.data.pricesRevertedCount,
          }),
        );
        loadLogs();
      } else {
        toast.error(res.error || t('rollbackError'));
      }
    } catch {
      toast.error(t('networkError'));
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
      downloadCsv(`import-errors-${log.id}.csv`, buildErrorsCsv(errors, t('csvErrorHeader')));
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
      setUploadMessage({ type: 'error', text: t('formatsSupported') });
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
        setUploadMessage({ type: 'error', text: data.error || t('readFileError') });
        setPricePreviewFile(null);
      }
    } catch {
      setUploadMessage({ type: 'error', text: t('fileReadError') });
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
          text:
            t('pricesUpdated', { updated: d.updated ?? 0, skipped: d.skipped ?? 0 }) +
            (errorCount > 0 ? t('summaryErrorsSuffix', { errors: errorCount }) : ''),
        });
        setLastErrors(d?.errors ?? []);
        setPricePreview(null);
        setPricePreviewFile(null);
        loadLogs();
      } else {
        setUploadMessage({ type: 'error', text: data.error || t('importError') });
        setLastErrors([]);
      }
    } catch {
      setUploadMessage({ type: 'error', text: t('uploadFileError') });
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
      setUploadMessage({ type: 'error', text: t('templatePriceError') });
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
    v === null
      ? '—'
      : v.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pctDelta = (oldV: number | null, newV: number | null) => {
    if (oldV === null || newV === null || oldV === 0) return null;
    return Math.round(((newV - oldV) / oldV) * 1000) / 10;
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">{t('title')}</h2>

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
          <h3 className="mb-3 text-sm font-semibold">{t('fullPricelist')}</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            {t('fullPricelistDesc1')}
            <strong>{t('barcodeWord')}</strong>
            {t('fullPricelistDesc2')}
          </p>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{t('dragHere')}</p>
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
                {isUploading ? t('uploading') : t('chooseFile')}
              </span>
            </label>
            <button
              type="button"
              onClick={downloadProductTemplate}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
            >
              {t('templateXlsx')}
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
            {t('quickPriceUpdate')}
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {t('recommended')}
            </span>
          </h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            {t('quickPriceDesc1')}
            <code>{t('codeWord')}</code>
            {t('quickPriceDesc2')}
          </p>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{t('dragHere')}</p>
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
                {isPricePreviewing ? t('analyzing') : t('chooseFile')}
              </span>
            </label>
            <button
              type="button"
              onClick={downloadPriceTemplate}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
            >
              {t('templateXlsx')}
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
          <h3 className="mb-3 text-sm font-semibold">{t('uploadImages')}</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            {t('uploadImagesDesc1')}
            <code>ABC123.jpg</code>
            {t('uploadImagesDesc2')}
            <code>4820001234567.jpg</code>
            {t('uploadImagesDesc3')}
          </p>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{t('dragHere')}</p>
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
              {t('chooseFile')}
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
                ? t('processingServer')
                : t('uploadingFile', { percent: uploadProgress })}
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
              {t('errorsFoundInFile', { count: lastErrors.length })}
            </h3>
            <Button size="sm" variant="outline" onClick={downloadLastErrorsCsv}>
              {t('downloadCsv')}
            </Button>
          </div>
          <div className="max-h-60 overflow-auto rounded border border-red-200 bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-red-50 text-red-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('thRow')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('thCode')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('thField')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('thError')}</th>
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
              {t('shownFirst100', { total: lastErrors.length })}
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
                {t('priceDiff')}
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {t('onlyPrices')}
                </span>
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('priceDiffInfo', {
                  filename: pricePreviewFile?.name ?? '',
                  rows: pricePreview.totalRows,
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePriceUpload} isLoading={isUploading}>
                {t('applyUpdate')}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelPricePreview}>
                {t('cancel')}
              </Button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">
              {t('willChange', { count: pricePreview.changedCount })}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
              {t('unchangedCount', { count: pricePreview.unchangedCount })}
            </span>
            {pricePreview.missingCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-1 font-medium text-red-700">
                {t('notFoundCount', { count: pricePreview.missingCount })}
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-auto rounded border border-[var(--color-border)] bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('thCode')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('thName')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('thRetail')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('thWholesale')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('thWholesale2')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('thWholesale3')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('thDelta')}</th>
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
                          <span className="text-red-600">{t('notFoundCell')}</span>
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
                                <span className="font-medium text-green-700">{fmtPrice(newV)}</span>
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
              {t('shownFirstN', {
                shown: pricePreview.sample.length,
                total: pricePreview.totalRows,
              })}
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
                {t('previewTitle')}
                {preview.format === 'supplier' && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {t('supplierFormat')}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('previewInfo', { filename: previewFile?.name ?? '', rows: preview.totalRows })}
                {preview.format === 'supplier' && t('supplierSuffix')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpload({ dryRun: true })}
                isLoading={isUploading}
                title={t('dryRunTitle')}
              >
                {t('checkDryRun')}
              </Button>
              <Button size="sm" onClick={() => handleUpload()} isLoading={isUploading}>
                {t('import')}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelPreview}>
                {t('cancel')}
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
              {t('shownFirst10', { total: preview.totalRows })}
            </p>
          )}
        </div>
      )}

      {/* Supplier channels — pull feeds from URLs */}
      <SupplierChannelsSection />

      {/* History */}
      <h3 className="mb-3 text-sm font-semibold">{t('historyTitle')}</h3>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">{t('thFile')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('thRows')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('thCreated')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('thUpdated')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('thErrors')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('thStatus')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('thDate')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('thActions')}</th>
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
                        ? t('statusCompleted')
                        : log.status.startsWith('failed')
                          ? t('statusFailed')
                          : t('statusInProgress')}
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
                          {downloadingLogId === log.id ? '…' : t('csvErrors')}
                        </button>
                      )}
                      {log.status.startsWith('completed') && !log.rollbackedAt && (
                        <button
                          type="button"
                          onClick={() => handleRollback(log)}
                          disabled={rollbackingId === log.id}
                          title={t('rollbackTitle')}
                          className="text-xs text-[var(--color-danger)] underline disabled:opacity-50"
                        >
                          {rollbackingId === log.id ? '…' : t('rollback')}
                        </button>
                      )}
                      {log.rollbackedAt && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {t('rolledBack')}
                        </span>
                      )}
                      {log.errorCount === 0 &&
                      log.status.startsWith('completed') &&
                      !log.rollbackedAt
                        ? null
                        : null}
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
                      <p className="text-sm font-medium">{t('emptyTitle')}</p>
                      <p className="text-xs">{t('emptyDesc')}</p>
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
