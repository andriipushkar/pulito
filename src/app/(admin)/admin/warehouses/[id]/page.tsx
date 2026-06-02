'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface StockItem {
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  reserved: number;
}

// The paginated stock endpoint returns WarehouseStock rows with the product
// nested; flatten to the flat StockItem the table renders.
interface StockRow {
  productId: number;
  quantity: number;
  reserved: number;
  product: { id: number; name: string; code: string } | null;
}

interface WarehouseMeta {
  id: number;
  name: string;
  code: string;
  city: string;
  isDefault: boolean;
}

const PAGE_SIZE = 50;

export default function AdminWarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('admin.warehouseDetailPage');

  const [meta, setMeta] = useState<WarehouseMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lowStock, setLowStock] = useState(''); // empty = no filter

  const [updateForm, setUpdateForm] = useState({ productId: '', quantity: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  // Warehouse metadata (name/code/city/default) loads once. The heavy stock
  // list is fetched separately via the paginated endpoint so a 50k-SKU
  // warehouse no longer ships every row in a single response.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<WarehouseMeta>(`/api/v1/admin/warehouses/${id}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setMeta(res.data);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Reload token bumps re-fetch the current page (e.g. after a stock edit).
  const [reloadToken, setReloadToken] = useState(0);
  const reloadStock = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStockLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (lowStock) params.set('lowStock', lowStock);
    apiClient
      .get<StockRow[]>(`/api/v1/admin/warehouses/${id}/stock?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setStock(
            res.data.map((r) => ({
              productId: r.productId,
              productName: r.product?.name ?? `#${r.productId}`,
              productCode: r.product?.code ?? '—',
              quantity: r.quantity,
              reserved: r.reserved,
            })),
          );
          if (res.pagination) setTotalPages(res.pagination.totalPages);
        }
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, page, lowStock, reloadToken]);

  const handleUpdateStock = async () => {
    const pid = Number(updateForm.productId);
    const qty = Number(updateForm.quantity);
    if (!pid || isNaN(qty)) {
      toast.error(t('validateError'));
      return;
    }
    setIsUpdating(true);
    const res = await apiClient.put(`/api/v1/admin/warehouses/${id}/stock`, {
      productId: pid,
      quantity: qty,
    });
    setIsUpdating(false);
    if (res.success) {
      toast.success(t('updatedToast'));
      setUpdateForm({ productId: '', quantity: '' });
      reloadStock();
    } else {
      toast.error(res.error || t('updateError'));
    }
  };

  if (metaLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">{t('notFound')}</p>
        <Link
          href="/admin/warehouses"
          className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline"
        >
          {t('backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/warehouses"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          {t('backArrow')}
        </Link>
        <h2 className="mt-1 text-xl font-bold">
          {meta.name}
          {meta.isDefault && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-sm font-normal text-blue-700">
              {t('defaultBadge')}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t('infoLine', { code: meta.code, city: meta.city || '—' })}
        </p>
      </div>

      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">{t('updateStock')}</h3>
        <div className="flex flex-wrap gap-3">
          <Input
            value={updateForm.productId}
            onChange={(e) => setUpdateForm({ ...updateForm, productId: e.target.value })}
            placeholder={t('productIdPh')}
            className="w-32"
          />
          <Input
            type="number"
            min={0}
            value={updateForm.quantity}
            onChange={(e) => setUpdateForm({ ...updateForm, quantity: e.target.value })}
            placeholder={t('quantityPh')}
            className="w-32"
          />
          <Button onClick={handleUpdateStock} isLoading={isUpdating}>
            {t('update')}
          </Button>
        </div>
      </div>

      {/* Low-stock triage: filter to SKUs with quantity below a threshold.
          Resets to page 1 so the filtered set starts from the top. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">{t('lowStockFilter')}</label>
        <Input
          type="number"
          min={0}
          value={lowStock}
          onChange={(e) => {
            setPage(1);
            setLowStock(e.target.value);
          }}
          placeholder={t('lowStockAll')}
          className="w-28"
        />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium">{t('colProduct')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('colCode')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colQty')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colReserved')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colAvailable')}</th>
            </tr>
          </thead>
          <tbody>
            {stockLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <Spinner size="sm" />
                </td>
              </tr>
            ) : (
              <>
                {stock.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="px-4 py-3 font-medium">{item.productName}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {item.productCode}
                    </td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                      {item.reserved}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          item.quantity - item.reserved <= 0
                            ? 'font-medium text-[var(--color-danger)]'
                            : ''
                        }
                      >
                        {item.quantity - item.reserved}
                      </span>
                    </td>
                  </tr>
                ))}
                {stock.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-[var(--color-text-secondary)]"
                    >
                      {t('empty')}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || stockLoading}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('prev')}
          </Button>
          <span className="text-sm">{t('pageOf', { page, totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || stockLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
