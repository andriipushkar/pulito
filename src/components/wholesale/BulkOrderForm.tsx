'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface ResolvedItem {
  productId: number;
  code: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  available: number;
}

interface BulkOrderResult {
  items: ResolvedItem[];
  totalAmount: number;
  errors: string[];
}

export default function BulkOrderForm() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<BulkOrderResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [proposalUrl, setProposalUrl] = useState<string | null>(null);

  const parseInput = (text: string) => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]+/).map((p) => p.trim());
        return { code: parts[0] || '', quantity: parseInt(parts[1] || '1', 10) || 1 };
      })
      .filter((item) => item.code.length > 0);
  };

  const handleResolve = async () => {
    const items = parseInput(input);
    if (items.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/wholesale/bulk-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.data);
      }
    } catch {
      // error
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!result?.items.length) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/wholesale/commercial-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: result.items.map((i) => ({ code: i.code, quantity: i.quantity })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProposalUrl(data.data.url);
      }
    } catch {
      // error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
          Введіть артикули товарів (код, кількість — по одному на рядок)
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"АРТ-001, 10\nАРТ-002, 5\nАРТ-003, 20"}
          rows={8}
          className="w-full rounded-xl border border-[var(--color-border)] p-3 font-mono text-sm focus:border-[var(--color-primary)] focus:outline-none"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Формат: код артикулу, кількість (розділювач: кома, крапка з комою або Tab)
        </p>
      </div>

      <Button onClick={handleResolve} disabled={isLoading || !input.trim()}>
        {isLoading ? 'Обробка...' : 'Розрахувати'}
      </Button>

      {result && (
        <div className="space-y-4">
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="mb-1 text-sm font-semibold text-amber-800">Попередження</h4>
              <ul className="text-xs text-amber-700">
                {result.errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {result.items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
                      <th className="pb-2">Код</th>
                      <th className="pb-2">Назва</th>
                      <th className="pb-2 text-right">К-сть</th>
                      <th className="pb-2 text-right">Ціна</th>
                      <th className="pb-2 text-right">Сума</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={item.productId} className="border-b border-[var(--color-border)]/30">
                        <td className="py-2 font-mono text-xs">{item.code}</td>
                        <td className="py-2">{item.name}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">{item.price.toFixed(2)}</td>
                        <td className="py-2 text-right font-semibold">{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={4} className="pt-3 text-right">Загалом:</td>
                      <td className="pt-3 text-right text-[var(--color-primary)]">
                        {result.totalAmount.toFixed(2)} грн
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleGenerateProposal} disabled={isLoading}>
                  Згенерувати комерційну пропозицію (PDF)
                </Button>
              </div>

              {proposalUrl && (
                <a
                  href={proposalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Завантажити PDF
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
