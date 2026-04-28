'use client';

import { useEffect, useState, useRef } from 'react';
import { apiClient, getAccessToken } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

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

interface ImportPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
  format: 'standard' | 'supplier';
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
  const [uploadMessage, setUploadMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [lastErrors, setLastErrors] = useState<ImportRowError[]>([]);
  const [downloadingLogId, setDownloadingLogId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<ImportLog[]>('/api/v1/admin/import/logs');
      if (res.success && res.data) setLogs(res.data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewFile(file);
    setUploadMessage(null);
    setPreview(null);

    // Get preview
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

  const handleUpload = async () => {
    if (!previewFile) return;

    setIsUploading(true);
    setUploadMessage(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', previewFile);

    try {
      // Simulate progress with XHR for progress tracking
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise<{
        success: boolean;
        data?: ImportResult;
        error?: string;
      }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 50)); // First 50% is upload
          }
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
        xhr.open('POST', '/api/v1/admin/import/products');
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        const uploadToken = getAccessToken();
        if (uploadToken) xhr.setRequestHeader('Authorization', `Bearer ${uploadToken}`);
        xhr.send(formData);
      });

      // Simulate processing progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 5, 95));
      }, 500);

      const data = await uploadPromise;
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (data.success) {
        const d = data.data;
        const errorCount = d?.errors?.length ?? 0;
        const summary = d
          ? `створено: ${d.created ?? 0}, оновлено: ${d.updated ?? 0}, пропущено: ${d.skipped ?? 0}${
              errorCount > 0 ? `, помилок: ${errorCount}` : ''
            }`
          : '0 товарів';
        setUploadMessage({
          type: errorCount > 0 ? 'error' : 'success',
          text: `Імпорт завершено — ${summary}`,
        });
        setLastErrors(d?.errors ?? []);
        setPreview(null);
        setPreviewFile(null);
        loadLogs();
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Помилка імпорту' });
        setLastErrors([]);
      }
    } catch {
      setUploadMessage({ type: 'error', text: 'Помилка завантаження файлу' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 3, 90));
      }, 300);

      const imgHeaders: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const imgToken = getAccessToken();
      if (imgToken) imgHeaders['Authorization'] = `Bearer ${imgToken}`;

      const res = await fetch('/api/v1/admin/import/images', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: imgHeaders,
      });
      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();
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
      e.target.value = '';
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

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Імпорт товарів</h2>

      {/* Upload section */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-3 text-sm font-semibold">Завантажити прайс-лист</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Підтримуються файли .xlsx, .xls та .csv. Стандартний формат: код, назва, категорія, ціна
            роздріб, ціна опт. Також підтримується формат постачальника (без коду) — категорії
            визначаються автоматично з рядків-роздільників.
          </p>
          <label className="inline-block">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
            />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]">
              {isUploading ? 'Завантаження...' : 'Обрати файл'}
            </span>
          </label>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <h3 className="mb-3 text-sm font-semibold">Завантажити зображення</h3>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Одне зображення або ZIP-архів. Назва файлу = код товару (наприклад: ABC123.jpg).
          </p>
          <label className="inline-block">
            <input
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

      {/* Progress bar */}
      {isUploading && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
            <span>Прогрес завантаження</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
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

      {/* Preview */}
      {preview && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Попередній перегляд</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {previewFile?.name} — {preview.totalRows} рядків
                {preview.format === 'supplier' &&
                  ' (формат постачальника — категорії з рядків-роздільників)'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpload} isLoading={isUploading}>
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
                    {log.errorCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => downloadLogErrorsCsv(log)}
                        disabled={downloadingLogId === log.id}
                        className="text-xs text-[var(--color-primary)] underline disabled:opacity-50"
                      >
                        {downloadingLogId === log.id ? '…' : 'CSV помилок'}
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                  >
                    Імпортів ще не було
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
