'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, getAccessToken } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import WysiwygEditor from '@/components/admin/WysiwygEditor';

interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  descriptionHtml: string | null;
  barcode: string | null;
  priceRetail: string | number;
  priceRetailOld: string | number | null;
  priceWholesale: string | number | null;
  quantity: number;
  weight: string | number | null;
  isActive: boolean;
  isPromo: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  imagePath: string | null;
  images: { id: number; pathMedium: string; sortOrder: number }[];
  categoryId: number | null;
  category?: { id: number; name: string } | null;
}

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    apiClient
      .get<ProductDetail>(`/api/v1/admin/products/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setProduct(res.data);
          setForm({
            name: res.data.name,
            code: res.data.code,
            slug: res.data.slug,
            barcode: res.data.barcode || '',
            description: res.data.description || '',
            descriptionHtml: res.data.descriptionHtml || '',
            priceRetail: String(res.data.priceRetail),
            priceRetailOld: res.data.priceRetailOld ? String(res.data.priceRetailOld) : '',
            priceWholesale: res.data.priceWholesale ? String(res.data.priceWholesale) : '',
            quantity: String(res.data.quantity),
            weight: res.data.weight ? String(res.data.weight) : '',
            isActive: res.data.isActive,
            isPromo: res.data.isPromo,
            metaTitle: res.data.metaTitle || '',
            metaDescription: res.data.metaDescription || '',
            categoryId: res.data.categoryId ? String(res.data.categoryId) : '',
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const updateField = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        slug: form.slug,
        barcode: (form.barcode as string) || null,
        description: (form.description as string) || null,
        descriptionHtml: (form.descriptionHtml as string) || null,
        priceRetail: Number(form.priceRetail),
        priceRetailOld: (form.priceRetailOld as string) ? Number(form.priceRetailOld) : null,
        priceWholesale: (form.priceWholesale as string) ? Number(form.priceWholesale) : null,
        quantity: Number(form.quantity),
        weight: (form.weight as string) ? Number(form.weight) : null,
        isActive: form.isActive,
        isPromo: form.isPromo,
        metaTitle: (form.metaTitle as string) || null,
        metaDescription: (form.metaDescription as string) || null,
        categoryId: (form.categoryId as string) ? Number(form.categoryId) : null,
      };
      const res = await apiClient.put(`/api/v1/admin/products/${id}`, payload);
      if (res.success) {
        setMessage({ type: 'success', text: 'Збережено!' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Помилка збереження' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Помилка мережі' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/admin/products/${id}/images`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        // Reload product to get updated images
        const updated = await apiClient.get<ProductDetail>(`/api/v1/admin/products/${id}`);
        if (updated.success && updated.data) setProduct(updated.data);
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('Видалити зображення?')) return;
    const res = await apiClient.delete(`/api/v1/admin/products/${id}/images/${imageId}`);
    if (res.success && product) {
      setProduct({ ...product, images: product.images.filter((img) => img.id !== imageId) });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  if (!product) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">Товар не знайдено</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/products')}>До списку</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/products" className="text-sm text-[var(--color-primary)] hover:underline">← Товари</Link>
        <h2 className="mt-1 text-xl font-bold">{product.name}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">ID: {product.id} | Код: {product.code}</p>
      </div>

      {message && (
        <div className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}>
          {message.text}
        </div>
      )}

      {/* Images */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Зображення</h3>
        <div className="flex flex-wrap gap-3">
          {product.images.map((img) => (
            <div key={img.id} className="group relative h-24 w-24 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.pathMedium} alt="" className="h-full w-full object-contain p-1" />
              <button
                onClick={() => handleDeleteImage(img.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Видалити
              </button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-[var(--radius)] border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]">
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
            <span className="text-2xl">+</span>
          </label>
        </div>
      </div>

      {/* Main info */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Основна інформація</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Назва *" value={form.name as string} onChange={(e) => updateField('name', e.target.value)} />
          <Input label="Код *" value={form.code as string} onChange={(e) => updateField('code', e.target.value)} />
          <Input label="Slug" value={form.slug as string} onChange={(e) => updateField('slug', e.target.value)} />
          <Input label="Штрихкод" value={form.barcode as string} onChange={(e) => updateField('barcode', e.target.value)} />
          <Input label="ID категорії" type="number" value={form.categoryId as string} onChange={(e) => updateField('categoryId', e.target.value)} />
          <Input label="Вага (кг)" type="number" value={form.weight as string} onChange={(e) => updateField('weight', e.target.value)} />
        </div>
      </div>

      {/* Prices & Stock */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Ціни та наявність</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Роздрібна ціна *" type="number" value={form.priceRetail as string} onChange={(e) => updateField('priceRetail', e.target.value)} />
          <Input label="Стара ціна" type="number" value={form.priceRetailOld as string} onChange={(e) => updateField('priceRetailOld', e.target.value)} />
          <Input label="Оптова ціна" type="number" value={form.priceWholesale as string} onChange={(e) => updateField('priceWholesale', e.target.value)} />
          <Input label="Кількість *" type="number" value={form.quantity as string} onChange={(e) => updateField('quantity', e.target.value)} />
        </div>
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive as boolean} onChange={(e) => updateField('isActive', e.target.checked)} className="accent-[var(--color-primary)]" />
            Активний
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPromo as boolean} onChange={(e) => updateField('isPromo', e.target.checked)} className="accent-[var(--color-primary)]" />
            Акційний
          </label>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Опис</h3>
        <WysiwygEditor value={form.descriptionHtml as string} onChange={(html) => updateField('descriptionHtml', html)} placeholder="Введіть опис товару..." />
      </div>

      {/* SEO */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">SEO</h3>
        <div className="space-y-4">
          <Input label="Meta Title" value={form.metaTitle as string} onChange={(e) => updateField('metaTitle', e.target.value)} />
          <div>
            <label className="mb-1 block text-sm font-medium">Meta Description</label>
            <textarea
              value={form.metaDescription as string}
              onChange={(e) => updateField('metaDescription', e.target.value)}
              rows={3}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} isLoading={isSaving}>Зберегти зміни</Button>
        <Button variant="outline" onClick={() => router.push('/admin/products')}>Скасувати</Button>
      </div>
    </div>
  );
}
