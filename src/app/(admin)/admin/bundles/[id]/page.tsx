'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface BundleItem {
  productId: number;
  productName: string;
  quantity: number;
}

interface BundleData {
  id: number;
  name: string;
  description: string;
  type: 'curated' | 'custom';
  discount: number;
  fixedPrice: number | null;
  isActive: boolean;
  items: BundleItem[];
}

export default function AdminBundleEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'curated' as 'curated' | 'custom',
    discount: 0,
    fixedPrice: '',
    isActive: true,
  });
  const [items, setItems] = useState<BundleItem[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get<BundleData>(`/api/v1/admin/bundles/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          setForm({
            name: d.name,
            description: d.description || '',
            type: d.type,
            discount: d.discount,
            fixedPrice: d.fixedPrice != null ? String(d.fixedPrice) : '',
            isActive: d.isActive,
          });
          setItems(d.items || []);
        }
      })
      .finally(() => setIsLoading(false));
  }, [id, isNew]);

  const addItem = () => {
    const pid = Number(newProductId);
    if (!pid) return;
    if (items.some((i) => i.productId === pid)) {
      toast.error('Товар вже додано');
      return;
    }
    setItems([...items, { productId: pid, productName: `Товар #${pid}`, quantity: Number(newQuantity) || 1 }]);
    setNewProductId('');
    setNewQuantity('1');
  };

  const removeItem = (productId: number) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const updateItemQty = (productId: number, quantity: number) => {
    setItems(items.map((i) => i.productId === productId ? { ...i, quantity } : i));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        fixedPrice: form.fixedPrice ? Number(form.fixedPrice) : null,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      };

      const res = isNew
        ? await apiClient.post('/api/v1/admin/bundles', payload)
        : await apiClient.patch(`/api/v1/admin/bundles/${id}`, payload);

      if (res.success) {
        toast.success(isNew ? 'Набір створено' : 'Збережено');
        if (isNew) router.push('/admin/bundles');
        else setMessage({ type: 'success', text: 'Збережено!' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Помилка збереження' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Помилка мережі' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/bundles" className="text-sm text-[var(--color-primary)] hover:underline">← Набори</Link>
          <h2 className="mt-1 text-xl font-bold">{isNew ? 'Новий набір' : form.name}</h2>
        </div>
        <Button onClick={handleSave} isLoading={isSaving}>Зберегти</Button>
      </div>

      {message && (
        <div className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Основне</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Назва *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div>
              <label className="mb-1 block text-sm font-medium">Тип</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'curated' | 'custom' })}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
              >
                <option value="curated">Готовий набір</option>
                <option value="custom">Довільний набір</option>
              </select>
            </div>
            <Input label="Знижка (%)" type="number" value={String(form.discount)} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
            <Input label="Фіксована ціна (грн)" value={form.fixedPrice} onChange={(e) => setForm({ ...form, fixedPrice: e.target.value })} placeholder="Залишити пустим для знижки" />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Опис</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-[var(--color-primary)]" />
              Активний
            </label>
          </div>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-3 text-sm font-semibold">Товари в наборі</h3>

          <div className="mb-4 flex flex-wrap gap-3">
            <Input value={newProductId} onChange={(e) => setNewProductId(e.target.value)} placeholder="ID товару" className="w-32" />
            <Input type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Кількість" className="w-28" />
            <Button variant="outline" onClick={addItem}>Додати товар</Button>
          </div>

          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <th className="px-4 py-2 text-left font-medium">ID товару</th>
                    <th className="px-4 py-2 text-left font-medium">Назва</th>
                    <th className="px-4 py-2 text-right font-medium">Кількість</th>
                    <th className="px-4 py-2 text-right font-medium">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.productId} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-2">{item.productId}</td>
                      <td className="px-4 py-2 text-[var(--color-text-secondary)]">{item.productName}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQty(item.productId, Number(e.target.value))}
                          className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => removeItem(item.productId)} className="text-xs text-[var(--color-danger)] hover:underline">
                          Видалити
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-[var(--color-text-secondary)]">Товарів не додано</p>
          )}
        </div>
      </div>
    </div>
  );
}
