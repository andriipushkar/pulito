'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface QuickProduct {
  id: number;
  name: string;
  code: string;
  slug: string;
  priceRetail: number | string;
  priceWholesale: number | string | null;
  quantity: number;
  isActive: boolean;
  isPromo: boolean;
}

interface Props {
  productId: number | null;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Right-side slide-over for quick product edits. Keeps the table visible on
 * the left so the operator can review one row, save, and continue without
 * losing scroll position.
 *
 * For full editing (SEO, content, images, variants, warehouse) the user clicks
 * "Open full page" — that's the existing /admin/products/[id] route.
 */
export default function ProductQuickEditDrawer({ productId, onClose, onSaved }: Props) {
  const t = useTranslations('admin.productQuickEdit');
  const [loadedProduct, setLoadedProduct] = useState<QuickProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Derive isLoading from "the loaded product id matches the requested one".
  // Avoids a synchronous setIsLoading(true) inside the fetch effect.
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const isLoading = productId !== null && loadedFor !== productId;
  // `product` is rendered conditionally; when productId is null we present
  // null without an unconditional setLoadedProduct(null) in the effect.
  const product = productId === null ? null : loadedProduct;
  const setProduct = setLoadedProduct;

  useEffect(() => {
    if (productId === null) {
      // Reset on close so reopening the same product re-fetches fresh data —
      // otherwise the drawer shows whatever was loaded last time, missing any
      // updates the admin made in the meantime (e.g. inline price edits).
      setLoadedFor(null);
      setLoadedProduct(null);
      return;
    }
    let cancelled = false;
    apiClient.get<QuickProduct>(`/api/v1/admin/products/${productId}`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setLoadedProduct(res.data);
      setLoadedFor(productId);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (productId === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [productId, onClose]);

  const save = async () => {
    if (!product) return;
    setIsSaving(true);
    const res = await apiClient.put(`/api/v1/admin/products/${product.id}`, {
      name: product.name,
      priceRetail: Number(product.priceRetail),
      priceWholesale:
        product.priceWholesale === null || product.priceWholesale === ''
          ? null
          : Number(product.priceWholesale),
      quantity: Number(product.quantity),
      isActive: product.isActive,
      isPromo: product.isPromo,
    });
    setIsSaving(false);
    if (res.success) {
      toast.success(t('saved'));
      onSaved?.();
      onClose();
    } else {
      toast.error(res.error || t('error'));
    }
  };

  if (productId === null) return null;

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="w-full max-w-md overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-2xl sm:max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{t('quickEdit')}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-[var(--color-bg-secondary)]"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        {isLoading || !product ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-[var(--color-text-secondary)]">
              {t('code')} <span className="font-mono">{product.code}</span>
            </div>
            <Input
              label={t('name')}
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('price')}
                type="number"
                step="0.01"
                value={String(product.priceRetail)}
                onChange={(e) => setProduct({ ...product, priceRetail: e.target.value })}
              />
              <Input
                label={t('wholesale')}
                type="number"
                step="0.01"
                value={product.priceWholesale === null ? '' : String(product.priceWholesale)}
                onChange={(e) => setProduct({ ...product, priceWholesale: e.target.value || null })}
              />
            </div>
            <Input
              label={t('quantity')}
              type="number"
              value={String(product.quantity)}
              onChange={(e) => setProduct({ ...product, quantity: Number(e.target.value) })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={product.isActive}
                onChange={(e) => setProduct({ ...product, isActive: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              {t('active')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={product.isPromo}
                onChange={(e) => setProduct({ ...product, isPromo: e.target.checked })}
                className="accent-[var(--color-primary)]"
              />
              {t('promo')}
            </label>

            <div className="flex flex-wrap gap-2 pt-3">
              <Button onClick={save} disabled={isSaving}>
                {isSaving ? t('saving') : t('save')}
              </Button>
              <Link
                href={`/admin/products/${product.id}`}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-secondary)]"
              >
                {t('fullEdit')}
              </Link>
            </div>
            <p className="pt-2 text-[10px] text-[var(--color-text-secondary)]">{t('escHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
