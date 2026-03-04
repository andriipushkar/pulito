'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import PageHeader from '@/components/account/PageHeader';

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
      <PageHeader
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        }
        title="Адреси доставки"
        subtitle={`${addresses.length} ${addresses.length === 1 ? 'адреса' : addresses.length < 5 ? 'адреси' : 'адрес'} збережено`}
        actions={
          !showForm ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] shadow-sm hover:bg-[var(--color-bg-secondary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Додати адресу
            </button>
          ) : undefined
        }
      />

      {/* ── Form ── */}
      {showForm && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-teal-200 bg-teal-50/50">
          <div className="border-b border-teal-200 bg-teal-50 px-5 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-teal-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={editId ? "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" : "M12 4.5v15m7.5-7.5h-15"} />
              </svg>
              {editId ? 'Редагувати адресу' : 'Нова адреса'}
            </h3>
          </div>
          <div className="p-5">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger)]">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Назва (мітка)" value={form.label} onChange={(e) => handleChange('label', e.target.value)} placeholder="Дім, Офіс..." />
              <Input label="Місто *" value={form.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="Київ" />
              <Input label="Вулиця" value={form.street} onChange={(e) => handleChange('street', e.target.value)} placeholder="вул. Хрещатик" />
              <Input label="Будинок" value={form.building} onChange={(e) => handleChange('building', e.target.value)} placeholder="12" />
              <Input label="Квартира" value={form.apartment} onChange={(e) => handleChange('apartment', e.target.value)} placeholder="34" />
              <Input label="Поштовий індекс" value={form.postalCode} onChange={(e) => handleChange('postalCode', e.target.value)} placeholder="01001" />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => handleChange('isDefault', e.target.checked)} className="rounded border-teal-300 text-teal-600 focus:ring-teal-500" />
              Адреса за замовчуванням
            </label>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSave} isLoading={saving} size="sm">Зберегти</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }} size="sm">Скасувати</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Addresses list ── */}
      {addresses.length === 0 && !showForm ? (
        <div className="bg-[var(--color-bg-secondary)]/40 rounded-2xl p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-500">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <p className="mb-1 font-medium text-[var(--color-text)]">У вас ще немає збережених адрес</p>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Додайте адресу для швидшого оформлення замовлень</p>
          <Button onClick={openCreate} size="sm">Додати першу адресу</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`group relative overflow-hidden rounded-2xl border bg-[var(--color-bg)] p-4 shadow-sm transition-all ${
                addr.isDefault ? 'border-teal-300 ring-1 ring-teal-100' : 'border-[var(--color-border)]/60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    addr.isDefault ? 'bg-teal-100 text-teal-600' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                  }`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{addr.label || 'Адреса'}</span>
                      {addr.isDefault && (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">
                          За замовчуванням
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {[addr.city, addr.street, addr.building && `буд. ${addr.building}`, addr.apartment && `кв. ${addr.apartment}`].filter(Boolean).join(', ')}
                      {addr.postalCode && ` (${addr.postalCode})`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!addr.isDefault && (
                    <button onClick={() => handleSetDefault(addr.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50" title="Зробити основною">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </button>
                  )}
                  <button onClick={() => openEdit(addr)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-blue-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(addr.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-danger)] hover:bg-red-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
