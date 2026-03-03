'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Heart, Trash, Cart } from '@/components/icons';
import { useCart } from '@/hooks/useCart';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

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
  const { addItem } = useCart();

  useEffect(() => {
    loadWishlists();
  }, []);

  const loadWishlists = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<Wishlist[]>('/api/v1/me/wishlists');
      if (res.success && res.data) {
        setWishlists(res.data.map((wl) => ({ ...wl, items: wl.items || [] })));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    const res = await apiClient.post<Wishlist>('/api/v1/me/wishlists', { name });
    if (res.success && res.data) {
      const newList = { ...res.data!, items: res.data!.items || [] };
      setWishlists((prev) => [...prev, newList]);
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

  const handleDeleteList = async (wishlistId: number) => {
    if (!confirm('Видалити цей список?')) return;
    await apiClient.delete(`/api/v1/me/wishlists/${wishlistId}`);
    setWishlists((prev) => prev.filter((wl) => wl.id !== wishlistId));
  };

  const handleRemoveItem = async (wishlistId: number, productId: number) => {
    await apiClient.delete(`/api/v1/me/wishlists/${wishlistId}/items/${productId}`);
    setWishlists((prev) =>
      prev.map((wl) =>
        wl.id === wishlistId
          ? { ...wl, items: wl.items.filter((i) => i.productId !== productId) }
          : wl
      )
    );
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
    const availableItems = wishlist.items.filter((i) => i.product.quantity > 0);
    for (const item of availableItems) {
      handleAddToCart(item);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  const totalItems = wishlists.reduce((sum, wl) => sum + wl.items.length, 0);

  if (wishlists.length === 0 && !showNewForm) {
    return (
      <div>
        <EmptyState
          icon={<Heart size={48} />}
          title="Обране порожнє"
          description="Додайте товари до обраного, натиснувши на іконку серця"
          actionLabel="Перейти до каталогу"
          actionHref="/catalog"
        />
        <div className="mt-4 text-center">
          <Button variant="secondary" onClick={() => setShowNewForm(true)}>
            Створити список
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Обране ({totalItems})</h2>
        {!showNewForm && (
          <Button size="sm" variant="secondary" onClick={() => setShowNewForm(true)}>
            + Новий список
          </Button>
        )}
      </div>

      {showNewForm && (
        <div className="mb-6 flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] p-3">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
            placeholder="Назва нового списку"
            className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            autoFocus
          />
          <Button size="sm" onClick={handleCreateList}>Створити</Button>
          <Button size="sm" variant="secondary" onClick={() => { setShowNewForm(false); setNewListName(''); }}>
            Скасувати
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {wishlists.map((wishlist) => (
          <div key={wishlist.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            {/* List header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              {editingId === wishlist.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameList(wishlist.id)}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRenameList(wishlist.id)}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    Зберегти
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditName(''); }}
                    className="text-xs text-[var(--color-text-secondary)] hover:underline"
                  >
                    Скасувати
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{wishlist.name}</h3>
                  <span className="text-xs text-[var(--color-text-secondary)]">({wishlist.items.length})</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {wishlist.items.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => handleAddAllToCart(wishlist)}>
                    <Cart size={14} /> Додати все в кошик
                  </Button>
                )}
                {editingId !== wishlist.id && (
                  <button
                    onClick={() => { setEditingId(wishlist.id); setEditName(wishlist.name); }}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                    title="Перейменувати"
                  >
                    Перейменувати
                  </button>
                )}
                <button
                  onClick={() => handleDeleteList(wishlist.id)}
                  className="text-xs text-[var(--color-danger)] hover:underline"
                  title="Видалити список"
                >
                  Видалити
                </button>
              </div>
            </div>

            {/* Items grid */}
            {wishlist.items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                Список порожній
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {wishlist.items.map((item) => {
                  const img = item.product.images?.[0]?.pathThumbnail || item.product.imagePath;
                  const inStock = item.product.quantity > 0;

                  return (
                    <div
                      key={item.productId}
                      className="rounded-[var(--radius)] border border-[var(--color-border)] p-3"
                    >
                      <div className="relative mb-2 aspect-square overflow-hidden rounded-[var(--radius)] bg-[var(--color-bg-secondary)]">
                        {img ? (
                          <Image src={img} alt={item.product.name} fill className="object-cover" sizes="200px" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
                            Фото
                          </div>
                        )}
                        <button
                          onClick={() => handleRemoveItem(wishlist.id, item.productId)}
                          className="absolute right-1 top-1 rounded-full bg-white/80 p-1 text-[var(--color-danger)] transition-colors hover:bg-white"
                          aria-label="Видалити з обраного"
                        >
                          <Trash size={14} />
                        </button>
                      </div>

                      <Link href={`/product/${item.product.slug}`} className="line-clamp-2 text-xs font-medium hover:text-[var(--color-primary)]">
                        {item.product.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Код: {item.product.code}</p>

                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-sm font-bold">{Number(item.product.priceRetail).toFixed(2)} ₴</span>
                        <span className={`text-xs ${inStock ? 'text-[var(--color-in-stock)]' : 'text-[var(--color-out-of-stock)]'}`}>
                          {inStock ? 'В наявності' : 'Немає'}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        disabled={!inStock}
                        onClick={() => handleAddToCart(item)}
                      >
                        <Cart size={14} /> В кошик
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
