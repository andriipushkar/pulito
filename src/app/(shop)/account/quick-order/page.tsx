'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import { useCart } from '@/hooks/useCart';
import * as XLSX from 'xlsx';

interface ResolvedLine {
  code: string;
  requestedQuantity: number;
  productId: number | null;
  productName: string | null;
  productSlug: string | null;
  priceRetail: number | null;
  priceWholesale: number | null;
  availableQuantity: number | null;
  imagePath: string | null;
  status: 'found' | 'not_found' | 'insufficient_stock';
}

function parseFileContent(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function parseCsvContent(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim());
  const results: string[] = [];
  for (const line of lines) {
    // Split by comma or semicolon
    const parts = line
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      results.push(`${parts[0]}  ${parts[1]}`);
    } else if (parts.length === 1) {
      results.push(`${parts[0]}  1`);
    }
  }
  return results.join('\n');
}

function parseXlsxContent(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return '';
  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const results: string[] = [];
  for (const row of rows) {
    if (row.length >= 2) {
      const code = String(row[0] ?? '').trim();
      const qty = String(row[1] ?? '1').trim();
      if (code) results.push(`${code}  ${qty}`);
    } else if (row.length === 1) {
      const code = String(row[0] ?? '').trim();
      if (code) results.push(`${code}  1`);
    }
  }
  return results.join('\n');
}

export default function QuickOrderPage() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ResolvedLine[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const parsed = parseXlsxContent(buffer);
        setInput((prev) => (prev ? prev + '\n' + parsed : parsed));
      } else if (ext === 'csv') {
        const text = await file.text();
        const parsed = parseCsvContent(text);
        setInput((prev) => (prev ? prev + '\n' + parsed : parsed));
      } else {
        // txt or any other text file
        const text = await file.text();
        const parsed = parseFileContent(text);
        setInput((prev) => (prev ? prev + '\n' + parsed : parsed));
      }
    } catch {
      alert('Помилка при читанні файлу');
    }
  }, []);

  if (user?.role !== 'wholesaler' && user?.role !== 'admin') {
    return (
      <div className="py-8 text-center text-[var(--color-text-secondary)]">
        Розділ доступний тільки для гуртових клієнтів
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleResolve = async () => {
    setIsLoading(true);
    setAddedToCart(false);
    const res = await apiClient.post<ResolvedLine[]>('/api/v1/quick-order', { input });
    if (res.success && res.data) setResults(res.data);
    setIsLoading(false);
  };

  const handleAddAll = () => {
    if (!results) return;
    const found = results.filter((r) => r.status === 'found' && r.productId);
    for (const item of found) {
      addItem({
        productId: item.productId!,
        name: item.productName || '',
        slug: item.productSlug || '',
        code: item.code,
        priceRetail: item.priceRetail || 0,
        priceWholesale: item.priceWholesale,
        imagePath: item.imagePath,
        quantity: item.requestedQuantity,
        maxQuantity: item.availableQuantity || item.requestedQuantity,
      });
    }
    setAddedToCart(true);
  };

  const foundCount = results?.filter((r) => r.status === 'found').length || 0;
  const totalSum =
    results
      ?.filter((r) => r.status === 'found')
      .reduce((s, r) => s + (r.priceWholesale || 0) * r.requestedQuantity, 0) || 0;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Швидке замовлення за кодами</h2>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Введіть список товарів у форматі: код кількість (по одному рядку) або завантажте файл
      </p>

      {/* File upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-4 cursor-pointer rounded-[var(--radius)] border-2 border-dashed p-4 text-center transition-colors ${
          isDragOver
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <svg
          className="mx-auto mb-2 h-8 w-8 text-[var(--color-text-secondary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Перетягніть файл або{' '}
          <span className="text-[var(--color-primary)]">натисніть для вибору</span>
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Підтримується: .txt, .csv, .xlsx
        </p>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`BH-001  24\nBH-015  12\nBH-042  48`}
        aria-label="Список товарів для швидкого замовлення"
        rows={8}
        className="mb-4 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-sm"
      />

      <Button onClick={handleResolve} isLoading={isLoading}>
        Розпізнати товари
      </Button>

      {results && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm">
              Знайдено: <strong>{foundCount}</strong> з {results.length} | Сума:{' '}
              <strong>{totalSum.toFixed(0)} грн</strong>
            </p>
            {foundCount > 0 && (
              <Button onClick={handleAddAll} variant={addedToCart ? 'secondary' : 'primary'}>
                {addedToCart ? 'Додано до кошика' : 'Додати все в кошик'}
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-4 py-2 text-left">Код</th>
                  <th className="px-4 py-2 text-left">Назва</th>
                  <th className="px-4 py-2 text-right">Ціна</th>
                  <th className="px-4 py-2 text-right">К-ть</th>
                  <th className="px-4 py-2 text-right">Сума</th>
                  <th className="px-4 py-2 text-center">Статус</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-t border-[var(--color-border)] ${r.status === 'not_found' ? 'bg-red-50' : r.status === 'insufficient_stock' ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-2 text-xs">{r.productName || '—'}</td>
                    <td className="px-4 py-2 text-right text-xs">
                      {r.priceWholesale ? `${r.priceWholesale.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">{r.requestedQuantity}</td>
                    <td className="px-4 py-2 text-right text-xs">
                      {r.priceWholesale
                        ? `${(r.priceWholesale * r.requestedQuantity).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {r.status === 'found' && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          OK
                        </span>
                      )}
                      {r.status === 'not_found' && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Не знайдено
                        </span>
                      )}
                      {r.status === 'insufficient_stock' && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                          Мало ({r.availableQuantity})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
