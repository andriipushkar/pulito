'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PersonalPrice {
  id: number;
  userId: number;
  user: { id: number; fullName: string; email: string };
  productId: number | null;
  product: { id: number; name: string; code: string } | null;
  categoryId: number | null;
  discountPercent: number | null;
  fixedPrice: number | null;
  validFrom: string | null;
  validUntil: string | null;
  creator: { id: number; fullName: string };
  createdAt: string;
}

interface FormData {
  userId: string;
  productId: string;
  categoryId: string;
  discountPercent: string;
  fixedPrice: string;
  validFrom: string;
  validUntil: string;
}

const emptyForm: FormData = {
  userId: '',
  productId: '',
  categoryId: '',
  discountPercent: '',
  fixedPrice: '',
  validFrom: '',
  validUntil: '',
};

export default function PersonalPricesPage() {
  const [items, setItems] = useState<PersonalPrice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const fetchData = useCallback(async () => {
    const res = await apiClient.get<PersonalPrice[]>(`/api/v1/admin/personal-prices?page=${page}&limit=20`);
    if (res.success && res.data) {
      setItems(res.data);
      setTotal((res as unknown as { pagination: { total: number } }).pagination?.total || 0);
    }
    setIsLoading(false);
  }, [page]);

  useEffect(() => {
    apiClient.get<PersonalPrice[]>(`/api/v1/admin/personal-prices?page=${page}&limit=20`).then((res) => {
      if (res.success && res.data) {
        setItems(res.data);
        setTotal((res as unknown as { pagination: { total: number } }).pagination?.total || 0);
      }
      setIsLoading(false);
    });
  }, [page]);

  const handleSubmit = async () => {
    setMessage('');
    const payload = {
      userId: parseInt(form.userId),
      productId: form.productId ? parseInt(form.productId) : undefined,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : undefined,
      fixedPrice: form.fixedPrice ? parseFloat(form.fixedPrice) : undefined,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
    };

    let res;
    if (editingId) {
      res = await apiClient.put(`/api/v1/admin/personal-prices/${editingId}`, payload);
    } else {
      res = await apiClient.post('/api/v1/admin/personal-prices', payload);
    }

    if (res.success) {
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchData();
    } else {
      setMessage(res.error || 'Помилка збереження');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Видалити цю персональну ціну?')) return;
    await apiClient.delete(`/api/v1/admin/personal-prices/${id}`);
    fetchData();
  };

  const handleEdit = (item: PersonalPrice) => {
    setEditingId(item.id);
    setForm({
      userId: String(item.userId),
      productId: item.productId ? String(item.productId) : '',
      categoryId: item.categoryId ? String(item.categoryId) : '',
      discountPercent: item.discountPercent ? String(item.discountPercent) : '',
      fixedPrice: item.fixedPrice ? String(item.fixedPrice) : '',
      validFrom: item.validFrom?.slice(0, 10) || '',
      validUntil: item.validUntil?.slice(0, 10) || '',
    });
    setShowModal(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Персональні ціни</h2>
        <Button onClick={() => { setForm(emptyForm); setEditingId(null); setShowModal(true); }}>
          + Додати
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Користувач</th>
              <th className="px-4 py-2 text-left">Товар/Категорія</th>
              <th className="px-4 py-2 text-right">Знижка %</th>
              <th className="px-4 py-2 text-right">Фікс. ціна</th>
              <th className="px-4 py-2 text-left">Термін</th>
              <th className="px-4 py-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">
                  <p className="text-xs font-medium">{item.user.fullName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.user.email}</p>
                </td>
                <td className="px-4 py-2 text-xs">
                  {item.product ? `${item.product.name} (${item.product.code})` : `Категорія #${item.categoryId}`}
                </td>
                <td className="px-4 py-2 text-right text-xs">
                  {item.discountPercent ? `${Number(item.discountPercent)}%` : '—'}
                </td>
                <td className="px-4 py-2 text-right text-xs">
                  {item.fixedPrice ? `${Number(item.fixedPrice).toFixed(2)} ₴` : '—'}
                </td>
                <td className="px-4 py-2 text-xs">
                  {item.validFrom ? new Date(item.validFrom).toLocaleDateString() : '∞'} — {item.validUntil ? new Date(item.validUntil).toLocaleDateString() : '∞'}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleEdit(item)} className="mr-2 text-xs text-[var(--color-primary)] hover:underline">Ред.</button>
                  <button onClick={() => handleDelete(item.id)} className="text-xs text-[var(--color-danger)] hover:underline">Вид.</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">Немає персональних цін</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Назад</Button>
          <span className="px-3 py-2 text-sm">Сторінка {page}</span>
          <Button onClick={() => setPage((p) => p + 1)} disabled={items.length < 20}>Далі</Button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-[var(--radius)] bg-[var(--color-bg)] p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">{editingId ? 'Редагувати' : 'Додати'} персональну ціну</h3>
            {message && <p className="mb-3 text-xs text-[var(--color-danger)]">{message}</p>}
            <div className="space-y-3">
              <Input label="ID користувача *" value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} disabled={!!editingId} />
              <Input label="ID товару" value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} />
              <Input label="ID категорії" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} />
              <Input label="Знижка (%)" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} />
              <Input label="Фіксована ціна (₴)" value={form.fixedPrice} onChange={(e) => setForm((f) => ({ ...f, fixedPrice: e.target.value }))} />
              <Input label="Дійсна з" type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
              <Input label="Дійсна до" type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => { setShowModal(false); setMessage(''); }}>Скасувати</Button>
              <Button onClick={handleSubmit}>Зберегти</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
