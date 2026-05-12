'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import WysiwygEditor from '@/components/admin/WysiwygEditor';
import BrandSelector from '@/components/admin/BrandSelector';
import { useFormValidation } from '@/hooks/useFormValidation';

interface CategoryOption {
  id: number;
  name: string;
}

const EMPTY_FORM = {
  code: '',
  name: '',
  categoryId: '',
  brandId: '',
  priceRetail: '',
  priceWholesale: '',
  priceWholesale2: '',
  priceWholesale3: '',
  quantity: '0',
  sortOrder: '0',
  isActive: true,
  isPromo: false,
  promoStartDate: '',
  promoEndDate: '',
  description: '',
  descriptionHtml: '',
  specifications: '',
  seoTitle: '',
  seoDescription: '',
};

export default function AdminProductCreatePage() {
  const router = useRouter();
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { errors, validateAll, clearError } = useFormValidation({
    name: { required: "Назва обов'язкова", minLength: { value: 2, message: 'Мінімум 2 символи' } },
    code: { required: "Код обов'язковий" },
    priceRetail: {
      required: "Ціна обов'язкова",
      min: { value: 0.01, message: 'Ціна має бути > 0' },
    },
    quantity: { min: { value: 0, message: "Кількість не може бути від'ємною" } },
    seoTitle: { maxLength: { value: 70, message: 'Максимум 70 символів' } },
    seoDescription: { maxLength: { value: 160, message: 'Максимум 160 символів' } },
  });

  useEffect(() => {
    apiClient.get<CategoryOption[]>('/api/v1/admin/categories').then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
  }, []);

  const updateField = useCallback(
    <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = async () => {
    if (!validateAll(form)) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim(),
        name: form.name.trim(),
        priceRetail: Number(form.priceRetail),
        quantity: Number(form.quantity) || 0,
        isActive: form.isActive,
        isPromo: form.isPromo,
      };
      if (form.categoryId) payload.categoryId = Number(form.categoryId);
      if (form.brandId) payload.brandId = Number(form.brandId);
      if (form.priceWholesale) payload.priceWholesale = Number(form.priceWholesale);
      if (form.priceWholesale2) payload.priceWholesale2 = Number(form.priceWholesale2);
      if (form.priceWholesale3) payload.priceWholesale3 = Number(form.priceWholesale3);
      if (Number(form.sortOrder)) payload.sortOrder = Number(form.sortOrder);
      if (form.description) payload.description = form.description;
      if (form.descriptionHtml) payload.descriptionHtml = form.descriptionHtml;
      if (form.specifications) payload.specifications = form.specifications;
      if (form.seoTitle) payload.seoTitle = form.seoTitle;
      if (form.seoDescription) payload.seoDescription = form.seoDescription;
      if (form.isPromo && form.promoStartDate) payload.promoStartDate = form.promoStartDate;
      if (form.isPromo && form.promoEndDate) payload.promoEndDate = form.promoEndDate;

      const res = await apiClient.post<{ id: number }>('/api/v1/admin/products', payload);
      if (res.success && res.data) {
        toast.success('Товар створено — тепер можна додати фото');
        router.push(`/admin/products/${res.data.id}`);
      } else {
        toast.error(res.error || 'Помилка створення');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  const categoryOptions = [
    { value: '', label: 'Без категорії' },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/products"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Товари
        </Link>
        <h2 className="mt-1 text-xl font-bold">Новий товар</h2>
      </div>

      {/* Images placeholder */}
      <div className="mb-6 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
        Зображення можна буде додати після збереження товару — щоб система знала, з яким товаром їх
        пов’язати.
      </div>

      {/* Main info */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Основна інформація</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Назва *"
            value={form.name}
            onChange={(e) => {
              updateField('name', e.target.value);
              clearError('name');
            }}
            error={errors.name}
          />
          <Input
            label="Код *"
            value={form.code}
            onChange={(e) => {
              updateField('code', e.target.value);
              clearError('code');
            }}
            error={errors.code}
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Категорія</label>
            <Select
              options={categoryOptions}
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Prices & Stock */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Ціни та наявність</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Роздрібна ціна *"
            type="number"
            value={form.priceRetail}
            onChange={(e) => {
              updateField('priceRetail', e.target.value);
              clearError('priceRetail');
            }}
            error={errors.priceRetail}
          />
          <Input
            label="Ціна: Дрібний опт"
            type="number"
            value={form.priceWholesale}
            onChange={(e) => updateField('priceWholesale', e.target.value)}
          />
          <Input
            label="Ціна: Середній опт"
            type="number"
            value={form.priceWholesale2}
            onChange={(e) => updateField('priceWholesale2', e.target.value)}
          />
          <Input
            label="Ціна: Великий опт"
            type="number"
            value={form.priceWholesale3}
            onChange={(e) => updateField('priceWholesale3', e.target.value)}
          />
          <Input
            label="Кількість *"
            type="number"
            value={form.quantity}
            onChange={(e) => {
              updateField('quantity', e.target.value);
              clearError('quantity');
            }}
            error={errors.quantity}
          />
          <Input
            label="Сортування"
            type="number"
            value={form.sortOrder}
            onChange={(e) => updateField('sortOrder', e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField('isActive', e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Активний
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPromo}
              onChange={(e) => updateField('isPromo', e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Акційний
          </label>
        </div>
        {form.isPromo && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Акція з</label>
              <input
                type="datetime-local"
                value={form.promoStartDate}
                onChange={(e) => updateField('promoStartDate', e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Акція по</label>
              <input
                type="datetime-local"
                value={form.promoEndDate}
                onChange={(e) => updateField('promoEndDate', e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Brand */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <BrandSelector value={form.brandId} onChange={(v) => updateField('brandId', v)} />
      </div>

      {/* Description */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Опис</h3>
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">Короткий опис</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={2}
            placeholder="Короткий опис для карток і пошуку (до 200 символів)"
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <label className="mb-1 block text-sm font-medium">Повний опис</label>
        <WysiwygEditor
          value={form.descriptionHtml}
          onChange={(html) => updateField('descriptionHtml', html)}
          placeholder="Розгорнутий опис товару..."
        />
      </div>

      {/* Specifications */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Характеристики</h3>
        <WysiwygEditor
          value={form.specifications}
          onChange={(html) => updateField('specifications', html)}
          placeholder="Склад, об’єм, маса, інструкція тощо. Покажеться як вкладка «Характеристики»."
        />
      </div>

      {/* SEO */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">SEO</h3>
        <div className="space-y-4">
          <div>
            <Input
              label="SEO Title"
              value={form.seoTitle}
              onChange={(e) => {
                updateField('seoTitle', e.target.value);
                clearError('seoTitle');
              }}
              error={errors.seoTitle}
            />
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {form.seoTitle.length}/70
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">SEO Description</label>
            <textarea
              value={form.seoDescription}
              onChange={(e) => {
                updateField('seoDescription', e.target.value);
                clearError('seoDescription');
              }}
              rows={3}
              className={`w-full rounded-[var(--radius)] border bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] ${errors.seoDescription ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}`}
            />
            {errors.seoDescription && (
              <p className="mt-0.5 text-xs text-[var(--color-danger)]">{errors.seoDescription}</p>
            )}
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {form.seoDescription.length}/160
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} isLoading={isSaving}>
          Створити товар
        </Button>
        <Button variant="outline" onClick={() => router.push('/admin/products')}>
          Скасувати
        </Button>
      </div>
    </div>
  );
}
