'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface TransferDetail {
  id: number;
  reference: string;
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled';
  fromWarehouse: { id: number; name: string; code: string };
  toWarehouse: { id: number; name: string; code: string };
  items: {
    id: number;
    quantity: number;
    product: { id: number; name: string; code: string };
  }[];
  shippedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  comment: string | null;
  createdAt: string;
}

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('admin.warehouseTransferDetailPage');
  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await apiClient.get<TransferDetail>(`/api/v1/admin/warehouse-transfers/${id}`);
    if (res.success && res.data) {
      setTransfer(res.data);
    } else {
      setError(res.error || t('notFound'));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const act = async (action: 'ship' | 'receive' | 'cancel' | 'cancel-in-transit') => {
    let reason: string | undefined;
    if (action === 'cancel' || action === 'cancel-in-transit') {
      const entered = prompt(t('cancelReasonPrompt'));
      if (entered === null) return; // user dismissed the dialog
      reason = entered;
    }
    setBusy(true);
    setError(null);
    const res = await apiClient.put<TransferDetail>(`/api/v1/admin/warehouse-transfers/${id}`, {
      action,
      ...(reason !== undefined ? { reason } : {}),
    });
    if (res.success && res.data) {
      setTransfer(res.data);
    } else {
      setError(res.error || t('errorGeneric'));
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!transfer) {
    return (
      <div>
        <p className="text-sm text-[var(--color-text-secondary)]">{error ?? t('notFound')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/admin/warehouse-transfers')}
        >
          {t('backToList')}
        </Button>
      </div>
    );
  }

  const totalQty = transfer.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div>
      <Link
        href="/admin/warehouse-transfers"
        className="text-sm text-[var(--color-primary)] hover:underline"
      >
        {t('backArrow')}
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold">{transfer.reference}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('created')}{' '}
            {new Date(transfer.createdAt).toLocaleString('uk-UA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {transfer.status === 'draft' && (
            <>
              <Button onClick={() => act('ship')} isLoading={busy}>
                {t('ship')}
              </Button>
              <Button variant="danger" onClick={() => act('cancel')} disabled={busy}>
                {t('cancel')}
              </Button>
            </>
          )}
          {transfer.status === 'in_transit' && (
            <>
              <Button onClick={() => act('receive')} isLoading={busy}>
                {t('receive')}
              </Button>
              {/* Goods lost/damaged in transit, or paperwork was wrong: release
                  the reserved units back to the source warehouse. */}
              <Button variant="danger" onClick={() => act('cancel-in-transit')} disabled={busy}>
                {t('cancelInTransit')}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius)] bg-red-50 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <InfoBlock title={t('from')}>
          <p className="text-base font-semibold">{transfer.fromWarehouse.name}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t('codeLabel')} {transfer.fromWarehouse.code}
          </p>
          {transfer.shippedAt && (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              {t('shippedOn')} {new Date(transfer.shippedAt).toLocaleString('uk-UA')}
            </p>
          )}
        </InfoBlock>
        <InfoBlock title={t('to')}>
          <p className="text-base font-semibold">{transfer.toWarehouse.name}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t('codeLabel')} {transfer.toWarehouse.code}
          </p>
          {transfer.receivedAt && (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              {t('receivedOn')} {new Date(transfer.receivedAt).toLocaleString('uk-UA')}
            </p>
          )}
        </InfoBlock>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {t('itemsTitle', { count: transfer.items.length, total: totalQty })}
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="py-2 text-left font-medium">{t('colArticle')}</th>
              <th className="py-2 text-left font-medium">{t('colName')}</th>
              <th className="py-2 text-right font-medium">{t('colQty')}</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-2 font-mono text-xs">{item.product.code}</td>
                <td className="py-2">{item.product.name}</td>
                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transfer.comment && (
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
            {t('commentLabel')}
          </p>
          <p className="whitespace-pre-wrap">{transfer.comment}</p>
        </div>
      )}

      {transfer.cancelledAt && (
        <div className="mt-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-700">
            {t('cancelledOn', { date: new Date(transfer.cancelledAt).toLocaleString('uk-UA') })}
          </p>
          {transfer.cancelledReason && (
            <p className="mt-1 text-red-700">{transfer.cancelledReason}</p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
        {title}
      </h3>
      {children}
    </div>
  );
}
