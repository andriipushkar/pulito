'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { OrderItemData, OrderDetail } from '@/types/order';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface EditableItem {
  itemId?: number;
  productId: number;
  productCode: string;
  productName: string;
  priceAtOrder: number;
  quantity: number;
  imagePath?: string | null;
  isRemoved: boolean;
  isNew: boolean;
}

interface SearchResult {
  id: number;
  name: string;
  code: string;
  priceRetail: number;
  priceWholesale: number | null;
  quantity: number;
  imagePath: string | null;
  images: { pathThumbnail: string | null }[];
}

interface OrderItemsEditorProps {
  orderId: number;
  items: OrderItemData[];
  onSaved: (updatedOrder: OrderDetail) => void;
  onClose: () => void;
}

export default function OrderItemsEditor({
  orderId,
  items,
  onSaved,
  onClose,
}: OrderItemsEditorProps) {
  const t = useTranslations('admin.orderItemsEditor');
  const [editItems, setEditItems] = useState<EditableItem[]>(() =>
    items.map((item) => ({
      itemId: item.id,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      priceAtOrder: Number(item.priceAtOrder),
      quantity: item.quantity,
      imagePath: item.imagePath,
      isRemoved: false,
      isNew: false,
    })),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await apiClient.get<{ products: SearchResult[] }>(
            `/api/v1/products/search?q=${encodeURIComponent(value)}`,
          );
          if (res.success && res.data?.products) {
            setSearchResults(res.data.products);
            setShowDropdown(true);
          } else if (!res.success) {
            toast.error(res.error || t('searchError'));
          }
        } catch {
          toast.error(t('searchNetworkError'));
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [t],
  );

  const handleAddProduct = (product: SearchResult) => {
    // Check duplicates
    const exists = editItems.find((item) => item.productId === product.id && !item.isRemoved);
    if (exists) {
      setError(t('alreadyAdded', { name: product.name }));
      setShowDropdown(false);
      setSearchQuery('');
      return;
    }

    // If was removed, restore it
    const removed = editItems.find((item) => item.productId === product.id && item.isRemoved);
    if (removed) {
      setEditItems((prev) =>
        prev.map((item) => (item.productId === product.id ? { ...item, isRemoved: false } : item)),
      );
    } else {
      setEditItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          priceAtOrder: Number(product.priceRetail),
          quantity: 1,
          imagePath: product.imagePath || product.images?.[0]?.pathThumbnail || null,
          isRemoved: false,
          isNew: true,
        },
      ]);
    }

    setSearchQuery('');
    setShowDropdown(false);
    setError(null);
  };

  const handleQuantityChange = (index: number, delta: number) => {
    setEditItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }),
    );
  };

  const handleQuantityInput = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) return;
    setEditItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: num } : item)),
    );
  };

  const handleRemove = (index: number) => {
    // One pass: new items disappear entirely, existing items are marked for
    // deletion. Two sequential setEditItems made the intent harder to read
    // and depended on the index being stable between the two updates.
    setEditItems((prev) =>
      prev.reduce<typeof prev>((acc, item, i) => {
        if (i !== index) return [...acc, item];
        if (item.isNew) return acc;
        return [...acc, { ...item, isRemoved: true }];
      }, []),
    );
  };

  const handleRestore = (index: number) => {
    setEditItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, isRemoved: false } : item)),
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const apiItems = editItems.map((item) => {
      if (item.isRemoved) {
        return { itemId: item.itemId, quantity: 0, remove: true };
      }
      if (item.isNew) {
        return { productId: item.productId, quantity: item.quantity };
      }
      return { itemId: item.itemId, quantity: item.quantity };
    });

    try {
      const res = await apiClient.put<OrderDetail>(`/api/v1/admin/orders/${orderId}/items`, {
        items: apiItems,
      });
      if (res.success && res.data) {
        onSaved(res.data);
      } else {
        setError(res.error || t('saveError'));
      }
    } catch {
      setError(t('networkError'));
    } finally {
      setIsSaving(false);
    }
  };

  const activeItems = editItems.filter((item) => !item.isRemoved);
  const total = activeItems.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);

  return (
    <div className="p-6">
      {/* Product search */}
      <div ref={searchRef} className="relative mb-4">
        <Input
          label={t('addProductLabel')}
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {isSearching && (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('searching')}</p>
        )}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
            {searchResults.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleAddProduct(product)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
              >
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                  {product.imagePath ? (
                    <Image
                      src={product.imagePath}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[8px] text-[var(--color-text-secondary)]">
                      {t('photo')}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {product.code} | {Number(product.priceRetail).toFixed(2)} ₴ | {t('stockLabel')}{' '}
                    {product.quantity}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
          <div className="absolute z-10 mt-1 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-center text-sm text-[var(--color-text-secondary)] shadow-lg">
            {t('notFound')}
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {editItems.map((item, index) => (
          <div
            key={`${item.productId}-${item.isNew ? 'new' : item.itemId}`}
            className={`flex items-center gap-3 rounded-[var(--radius)] border p-3 ${
              item.isRemoved
                ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 opacity-60'
                : item.isNew
                  ? 'border-green-300 bg-green-50'
                  : 'border-[var(--color-border)]'
            }`}
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
              {item.imagePath ? (
                <Image src={item.imagePath} alt="" fill className="object-cover" sizes="40px" />
              ) : (
                <div className="flex h-full items-center justify-center text-[8px] text-[var(--color-text-secondary)]">
                  {t('photo')}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.isRemoved ? 'line-through' : ''}`}>
                {item.productName}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {item.productCode} | {item.priceAtOrder.toFixed(2)} ₴
                {item.isNew && <span className="ml-1 text-green-600">{t('newBadge')}</span>}
              </p>
            </div>

            {!item.isRemoved && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(index, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-secondary)]"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => handleQuantityInput(index, e.target.value)}
                  className="h-7 w-14 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-center text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleQuantityChange(index, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-secondary)]"
                >
                  +
                </button>
              </div>
            )}

            <div className="w-20 text-right text-sm font-medium">
              {(item.priceAtOrder * item.quantity).toFixed(2)} ₴
            </div>

            {item.isRemoved ? (
              <button
                type="button"
                onClick={() => handleRestore(index)}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                {t('restore')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="text-xs text-[var(--color-danger)] hover:underline"
              >
                {t('remove')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <span className="text-sm font-medium">
          {t('itemsCount', { count: activeItems.reduce((sum, i) => sum + i.quantity, 0) })}
        </span>
        <span className="text-lg font-bold">{t('total', { total: total.toFixed(2) })}</span>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          {t('cancel')}
        </Button>
        <Button onClick={handleSave} isLoading={isSaving}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
