'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Heart, Trash, Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/account/PageHeader';

interface WishlistItem {
  productId: number;
  product: {
    id: number;
    name: string;
    slug: string;
    code: string;
    priceRetail: number;
    priceWholesale: number | null;
    quantity: number;
    imagePath: string | null;
    images: { pathThumbnail: string | null }[];
  };
}

interface Wishlist {
  id: number;
  name: string;
  items: WishlistItem[];
}

export default function WishlistPage() {
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [error, setError] = useState('');
  const { addItem } = useCart();

  const loadWishlists = useCallback(async () => {
    try {
      const res = await apiClient.get<Wishlist[]>('/api/v1/me/wishlists');
      if (res.success && res.data) {
        setWishlists(res.data.map((wl) => ({
          ...wl,
          items: (wl.items || []).filter((i) => i.product && i.product.name),
        })));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlists();
  }, [loadWishlists]);

  const markBusy = (id: number) => setBusyIds((s) => new Set(s).add(id));
  const unmarkBusy = (id: number) => setBusyIds((s) => { const n = new Set(s); n.delete(id); return n; });

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    const res = await apiClient.post<Wishlist>('/api/v1/me/wishlists', { name });
    if (res.success && res.data) {
      setWishlists((prev) => [...prev, { ...res.data!, items: res.data!.items || [] }]);
      setNewListName('');
      setShowNewForm(false);
    }
  };

  const handleRenameList = async (wishlistId: number) => {
    const name = editName.trim();
    if (!name) return;
    const res = await apiClient.put<Wishlist>(`/api/v1/me/wishlists/${wishlistId}`, { name });
    if (res.success) {
      setWishlists((prev) => prev.map((wl) => (wl.id === wishlistId ? { ...wl, name } : wl)));
      setEditingId(null);
      setEditName('');
    }
  };

  const deleteOneList = async (wishlistId: number): Promise<boolean> => {
    markBusy(wishlistId);
    setError('');
    try {
      const res = await apiClient.delete<{ message: string }>(`/api/v1/me/wishlists/${wishlistId}`);
      if (res.success) {
        setWishlists((prev) => prev.filter((wl) => wl.id !== wishlistId));
        return true;
      } else {
        setError(res.error || `Не вдалося видалити список #${wishlistId}`);
        return false;
      }
    } catch (e) {
      setError(`Помилка мережі при видаленні списку #${wishlistId}`);
      return false;
    } finally {
      unmarkBusy(wishlistId);
    }
  };

  const handleDeleteList = async (wishlistId: number) => {
    await deleteOneList(wishlistId);
  };

  const handleCleanupEmpty = async () => {
    setIsCleaningUp(true);
    setError('');
    try {
      // Use bulk-delete endpoint
      const res = await apiClient.delete<{ deleted: number }>('/api/v1/me/wishlists');
      if (res.success) {
        // Reload fresh data
        await loadWishlists();
      } else {
        setError(res.error || 'Не вдалося очистити порожні списки');
      }
    } catch {
      setError('Помилка мережі');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleRemoveItem = async (wishlistId: number, productId: number) => {
    const res = await apiClient.delete(`/api/v1/me/wishlists/${wishlistId}/items/${productId}`);
    if (res.success) {
      setWishlists((prev) =>
        prev.map((wl) =>
          wl.id === wishlistId
            ? { ...wl, items: wl.items.filter((i) => i.productId !== productId) }
            : wl
        )
      );
    }
  };

  const handleAddToCart = (item: WishlistItem) => {
    const img = item.product.images?.[0]?.pathThumbnail || item.product.imagePath;
    addItem({
      productId: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      code: item.product.code,
      priceRetail: Number(item.product.priceRetail),
      priceWholesale: item.product.priceWholesale ? Number(item.product.priceWholesale) : null,
      imagePath: img,
      quantity: 1,
      maxQuantity: item.product.quantity,
    });
  };

  const handleAddAllToCart = (wishlist: Wishlist) => {
    for (const item of wishlist.items.filter((i) => i.product.quantity > 0)) {
      handleAddToCart(item);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  const totalItems = wishlists.reduce((sum, wl) => sum + wl.items.length, 0);
  const emptyCount = wishlists.filter((wl) => wl.items.length === 0).length;
  const nonEmptyLists = wishlists.filter((wl) => wl.items.length > 0);
  const emptyLists = wishlists.filter((wl) => wl.items.length === 0);

  return (
    <div>
      <PageHeader
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        }
        title={`Обране (${totalItems})`}
        subtitle={`${wishlists.length} ${wishlists.length === 1 ? 'список' : wishlists.length < 5 ? 'списки' : 'списків'}`}
        actions={
          !showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-sm hover:bg-[var(--color-bg-secondary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Новий список
            </button>
          ) : undefined
        }
      />

      {/* ── Error message ── */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Cleanup banner ── */}
      {emptyCount > 1 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>У вас <strong>{emptyCount}</strong> порожніх списків.</span>
          </div>
          <button
            onClick={handleCleanupEmpty}
            disabled={isCleaningUp}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {isCleaningUp ? (
              <Spinner size="sm" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            )}
            Очистити порожні
          </button>
        </div>
      )}

      {/* ── New list form ── */}
      {showNewForm && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/50">
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-3">
            <h3 className="text-sm font-semibold text-rose-800">Новий список</h3>
          </div>
          <div className="flex items-center gap-3 p-4">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              placeholder="Назва нового списку"
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm"
              autoFocus
            />
            <Button size="sm" onClick={handleCreateList}>Створити</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowNewForm(false); setNewListName(''); }}>
              Скасувати
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {wishlists.length === 0 && !showNewForm && (
        <EmptyState
          icon={
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-400">
              <Heart size={32} />
            </div>
          }
          title="Обране порожнє"
          description="Додайте товари до обраного, натиснувши на іконку серця на картці товару"
          actionLabel="Перейти до каталогу"
          actionHref="/catalog"
        />
      )}

      {/* ── Lists with items (full card view) ── */}
      <div className="space-y-6">
        {nonEmptyLists.map((wishlist) => (
          <div key={wishlist.id} className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-3">
              {editingId === wishlist.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameList(wishlist.id)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                    autoFocus
                  />
                  <button onClick={() => handleRenameList(wishlist.id)} className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white">
                    OK
                  </button>
                  <button onClick={() => { setEditingId(null); setEditName(''); }} className="text-xs text-[var(--color-text-secondary)]">
                    Скасувати
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-500">
                    <Heart size={14} />
                  </div>
                  <h3 className="text-sm font-bold">{wishlist.name}</h3>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {wishlist.items.length}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddAllToCart(wishlist)}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)]"
                >
                  <Cart size={12} /> Все в кошик
                </button>
                {editingId !== wishlist.id && (
                  <button
                    onClick={() => { setEditingId(wishlist.id); setEditName(wishlist.name); }}
                    className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                    title="Перейменувати"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDeleteList(wishlist.id)}
                  disabled={busyIds.has(wishlist.id)}
                  className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  title="Видалити список"
                >
                  {busyIds.has(wishlist.id) ? <Spinner size="sm" /> : <Trash size={16} />}
                </button>
              </div>
            </div>

            {/* Products grid */}
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {wishlist.items.map((item) => {
                const img = item.product.images?.[0]?.pathThumbnail || item.product.imagePath;
                const inStock = item.product.quantity > 0;

                return (
                  <div key={item.productId} className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)]/60 shadow-sm transition-all">
                    <div className="relative aspect-square overflow-hidden bg-[var(--color-bg-secondary)]">
                      {img ? (
                        <Image src={img} alt={item.product.name} fill className="object-cover transition-transform group-hover:scale-105" sizes="200px" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)] opacity-30">
                          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveItem(wishlist.id, item.productId)}
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-500 opacity-0 shadow-sm transition-all hover:bg-white group-hover:opacity-100"
                        aria-label="Видалити з обраного"
                      >
                        <Trash size={14} />
                      </button>
                      {!inStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600">Немає</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <Link href={`/product/${item.product.slug}`} className="line-clamp-2 text-xs font-medium leading-snug hover:text-[var(--color-primary)]">
                        {item.product.name}
                      </Link>
                      <div className="mt-auto pt-2">
                        <span className="text-sm font-bold">{Number(item.product.priceRetail).toFixed(2)} ₴</span>
                        <button
                          disabled={!inStock}
                          onClick={() => handleAddToCart(item)}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] py-2 text-xs font-medium text-white hover:bg-[var(--color-primary-dark)] disabled:bg-gray-200 disabled:text-gray-400"
                        >
                          <Cart size={12} /> В кошик
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Empty lists (compact rows) ── */}
        {emptyLists.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/60">
            <div className="border-b border-[var(--color-border)]/60 px-5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Порожні списки ({emptyLists.length})
              </p>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {emptyLists.map((wishlist) => (
                <div key={wishlist.id} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--color-bg-secondary)]/30">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                      <Heart size={12} />
                    </div>
                    {editingId === wishlist.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameList(wishlist.id)}
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm"
                          autoFocus
                        />
                        <button onClick={() => handleRenameList(wishlist.id)} className="text-xs font-medium text-[var(--color-primary)]">OK</button>
                        <button onClick={() => { setEditingId(null); setEditName(''); }} className="text-xs text-[var(--color-text-secondary)]">Скасувати</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{wishlist.name}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">Порожній</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {editingId !== wishlist.id && (
                      <button
                        onClick={() => { setEditingId(wishlist.id); setEditName(wishlist.name); }}
                        className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteList(wishlist.id)}
                      disabled={busyIds.has(wishlist.id)}
                      className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      {busyIds.has(wishlist.id) ? <Spinner size="sm" /> : <Trash size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
