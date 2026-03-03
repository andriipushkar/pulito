'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface Address {
  id: number;
  label: string | null;
  city: string;
  street: string | null;
  building: string | null;
  apartment: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

const emptyForm = { label: '', city: '', street: '', building: '', apartment: '', postalCode: '', isDefault: false };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await apiClient.get<Address[]>('/api/v1/me/addresses');
    if (res.success && res.data) setAddresses(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    apiClient.get<Address[]>('/api/v1/me/addresses').then((res) => {
      if (res.success && res.data) setAddresses(res.data);
      setIsLoading(false);
    });
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  };

  const openEdit = (addr: Address) => {
    setEditId(addr.id);
    setForm({
      label: addr.label || '',
      city: addr.city,
      street: addr.street || '',
      building: addr.building || '',
      apartment: addr.apartment || '',
      postalCode: addr.postalCode || '',
      isDefault: addr.isDefault,
    });
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.city.trim()) { setError('Вкажіть місто'); return; }
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      label: form.label || undefined,
      street: form.street || undefined,
      building: form.building || undefined,
      apartment: form.apartment || undefined,
      postalCode: form.postalCode || undefined,
    };

    const res = editId
      ? await apiClient.put(`/api/v1/me/addresses/${editId}`, payload)
      : await apiClient.post('/api/v1/me/addresses', payload);

    setSaving(false);
    if (res.success) {
      setShowForm(false);
      setEditId(null);
      load();
    } else {
      setError(res.error || 'Помилка збереження');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Видалити цю адресу?')) return;
    await apiClient.delete(`/api/v1/me/addresses/${id}`);
    load();
  };

  const handleSetDefault = async (id: number) => {
    await apiClient.put(`/api/v1/me/addresses/${id}`, { isDefault: true });
    load();
  };

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Адреси доставки</h2>
        {!showForm && (
          <Button onClick={openCreate} size="sm">Додати адресу</Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] p-4">
          <h3 className="mb-4 font-semibold">{editId ? 'Редагувати адресу' : 'Нова адреса'}</h3>
          {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-[var(--color-danger)]">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Назва (мітка)" value={form.label} onChange={(e) => handleChange('label', e.target.value)} placeholder="Дім, Офіс..." />
            <Input label="Місто *" value={form.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="Київ" />
            <Input label="Вулиця" value={form.street} onChange={(e) => handleChange('street', e.target.value)} placeholder="вул. Хрещатик" />
            <Input label="Будинок" value={form.building} onChange={(e) => handleChange('building', e.target.value)} placeholder="12" />
            <Input label="Квартира" value={form.apartment} onChange={(e) => handleChange('apartment', e.target.value)} placeholder="34" />
            <Input label="Поштовий індекс" value={form.postalCode} onChange={(e) => handleChange('postalCode', e.target.value)} placeholder="01001" />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => handleChange('isDefault', e.target.checked)} />
            Адреса за замовчуванням
          </label>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} isLoading={saving} size="sm">Зберегти</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }} size="sm">Скасувати</Button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-8 text-center">
          <p className="mb-2 text-[var(--color-text-secondary)]">У вас ще немає збережених адрес</p>
          <Button onClick={openCreate} size="sm">Додати першу адресу</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="flex items-start justify-between rounded-[var(--radius)] border border-[var(--color-border)] p-4">
              <div>
                <div className="flex items-center gap-2">
                  {addr.label && <span className="font-semibold">{addr.label}</span>}
                  {addr.isDefault && (
                    <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                      За замовчуванням
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {[addr.city, addr.street, addr.building && `буд. ${addr.building}`, addr.apartment && `кв. ${addr.apartment}`].filter(Boolean).join(', ')}
                  {addr.postalCode && ` (${addr.postalCode})`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!addr.isDefault && (
                  <button onClick={() => handleSetDefault(addr.id)} className="rounded px-2 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]" title="Зробити основною">
                    За замовч.
                  </button>
                )}
                <button onClick={() => openEdit(addr)} className="rounded px-2 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]">
                  Редагувати
                </button>
                <button onClick={() => handleDelete(addr.id)} className="rounded px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-red-50">
                  Видалити
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
