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
import SpecsEditor from '@/components/admin/SpecsEditor';
import BrandSelector from '@/components/admin/BrandSelector';
import BarcodeInput from '@/components/admin/BarcodeInput';
import { useFormValidation } from '@/hooks/useFormValidation';

interface CategoryOption {
  id: number;
  name: string;
}

const EMPTY_FORM = {
  code: '',
  barcode: '',
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini' | 'rules'>('claude');
  const [stagedImages, setStagedImages] = useState<File[]>([]);
  const [removeBg, setRemoveBg] = useState(true);

  // Restore last-used AI provider from localStorage.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pulito.aiProvider') : null;
    if (stored === 'claude' || stored === 'gemini' || stored === 'rules') {
      setAiProvider(stored);
    }
  }, []);
  const updateAiProvider = (v: 'claude' | 'gemini' | 'rules') => {
    setAiProvider(v);
    if (typeof window !== 'undefined') localStorage.setItem('pulito.aiProvider', v);
  };
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
        barcode: form.barcode.trim() || null,
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
        const productId = res.data.id;
        // Upload staged images now that we have a product ID
        if (stagedImages.length > 0) {
          toast.success('Товар створено. Завантажуємо фото…');
          const fd = new FormData();
          for (const f of stagedImages) fd.append('images', f);
          fd.append('isMain', stagedImages.length === 1 ? 'true' : 'false');
          fd.append('removeBg', removeBg ? 'true' : 'false');
          try {
            await apiClient.upload(`/api/v1/admin/products/${productId}/images`, fd);
          } catch {
            toast.error('Товар створено, але деякі фото не завантажились');
          }
        } else {
          toast.success('Товар створено');
        }
        router.push(`/admin/products/${productId}`);
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

      {/* Images — staged: previewed locally, uploaded after product is created */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Зображення</h3>
        <div className="flex flex-wrap items-start gap-3">
          {stagedImages.map((file, i) => (
            <div
              key={i}
              className="relative h-24 w-24 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="h-full w-full object-cover"
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
              <button
                type="button"
                onClick={() => setStagedImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                aria-label="Видалити фото"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-[10px] font-medium">Додати фото</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length) setStagedImages((prev) => [...prev, ...files]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {stagedImages.length === 0 && (
          <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
            Фото завантажаться автоматично після створення товару
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={removeBg}
            onChange={(e) => setRemoveBg(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          <span>
            Автоматично видалити фон при завантаженні
            <span className="ml-1 text-xs text-[var(--color-text-secondary)]">
              (товар буде розміщено на фоні сайту)
            </span>
          </span>
        </label>
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
          <BarcodeInput
            value={form.barcode}
            onChange={(v) => updateField('barcode', v)}
            onScanned={async (barcode) => {
              // Auto-fill from Open Food Facts when a valid barcode is entered
              try {
                const res = await apiClient.post<{
                  source: 'local' | 'open_food_facts' | 'none';
                  existing?: { id: number; name: string };
                  data?: {
                    name: string | null;
                    brand: string | null;
                    imageUrl: string | null;
                    quantity: string | null;
                  };
                }>('/api/v1/admin/products/lookup-barcode', { barcode });
                if (!res.success || !res.data) return;
                if (res.data.source === 'local' && res.data.existing) {
                  toast.error(
                    `Товар із цим штрихкодом уже існує: «${res.data.existing.name}». Відкрийте його замість створення дубля.`,
                    { duration: 6000 },
                  );
                  return;
                }
                if (res.data.source === 'open_food_facts' && res.data.data) {
                  const d = res.data.data;
                  setForm((prev) => ({
                    ...prev,
                    // Don't overwrite what the admin already typed
                    name: prev.name || d.name || prev.name,
                    code: prev.code || barcode,
                  }));
                  toast.success(
                    `Знайдено в Open Food Facts${d.brand ? ` (${d.brand})` : ''}. Перевірте поля.`,
                  );
                } else {
                  toast(`Штрихкод збережено. Не знайдено в довіднику — заповніть вручну.`);
                }
              } catch {
                // ignore — server-side error already logs
              }
            }}
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
            min="0"
            step="0.01"
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
            min="0"
            step="0.01"
            value={form.priceWholesale}
            onChange={(e) => updateField('priceWholesale', e.target.value)}
          />
          <Input
            label="Ціна: Середній опт"
            type="number"
            min="0"
            step="0.01"
            value={form.priceWholesale2}
            onChange={(e) => updateField('priceWholesale2', e.target.value)}
          />
          <Input
            label="Ціна: Великий опт"
            type="number"
            min="0"
            step="0.01"
            value={form.priceWholesale3}
            onChange={(e) => updateField('priceWholesale3', e.target.value)}
          />
          <Input
            label="Кількість *"
            type="number"
            min="0"
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Опис</h3>
          <div className="flex items-center gap-2">
            <select
              value={aiProvider}
              onChange={(e) => updateAiProvider(e.target.value as 'claude' | 'gemini' | 'rules')}
              disabled={isGenerating}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
              title="Виберіть джерело генерації"
            >
              <option value="claude">Claude (дорого, найкраща якість)</option>
              <option value="gemini">Gemini (дешево)</option>
              <option value="rules">Без AI (шаблон)</option>
            </select>
            <button
              type="button"
              disabled={isGenerating || !form.name.trim()}
              onClick={async () => {
                if (!form.name.trim()) {
                  toast.error('Спочатку введіть назву товару');
                  return;
                }
                setIsGenerating(true);
                try {
                  const res = await apiClient.post<{
                    seoTitle: string;
                    seoDescription: string;
                    shortDescription: string;
                    fullDescription: string;
                  }>('/api/v1/admin/products/ai-generate-preview', {
                    name: form.name,
                    categoryId: form.categoryId ? Number(form.categoryId) : null,
                    brandId: form.brandId ? Number(form.brandId) : null,
                    priceRetail: Number(form.priceRetail) || 0,
                    shortDescription: form.description || null,
                    provider: aiProvider,
                  });
                  if (!res.success || !res.data) {
                    toast.error(res.error || 'Не вдалося згенерувати');
                    return;
                  }
                  const conflicts: string[] = [];
                  if (form.seoTitle.trim()) conflicts.push('SEO Title');
                  if (form.seoDescription.trim()) conflicts.push('SEO Description');
                  if (form.description.trim()) conflicts.push('Короткий опис');
                  if (form.descriptionHtml.trim()) conflicts.push('Повний опис');
                  if (
                    conflicts.length > 0 &&
                    !window.confirm(
                      `Замінити заповнені поля?\n\n${conflicts.join(', ')}\n\nOK — замінити, Cancel — лишити як є.`,
                    )
                  ) {
                    setForm((prev) => ({
                      ...prev,
                      seoTitle: prev.seoTitle || res.data!.seoTitle,
                      seoDescription: prev.seoDescription || res.data!.seoDescription,
                      description: prev.description || res.data!.shortDescription,
                      descriptionHtml: prev.descriptionHtml || res.data!.fullDescription,
                    }));
                    toast.success('Заповнено лише порожні поля');
                    return;
                  }
                  setForm((prev) => ({
                    ...prev,
                    seoTitle: res.data!.seoTitle,
                    seoDescription: res.data!.seoDescription,
                    description: res.data!.shortDescription,
                    descriptionHtml: res.data!.fullDescription,
                  }));
                  toast.success('Згенеровано — перевірте поля');
                } catch (err) {
                  console.error('[AI generate-preview]', err);
                  toast.error('Помилка мережі');
                } finally {
                  setIsGenerating(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
              title={
                !form.name.trim()
                  ? 'Спочатку введіть назву товару'
                  : 'Згенерувати SEO-опис на основі назви, бренду, категорії'
              }
            >
              {isGenerating ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Генеруємо…
                </>
              ) : (
                <>✨ Згенерувати</>
              )}
            </button>
          </div>
        </div>
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

      {/* Specifications — structured key/value pairs */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Характеристики</h3>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            Об&apos;єм, склад, торгова марка, інструкція тощо
          </span>
        </div>
        <SpecsEditor
          value={form.specifications}
          onChange={(next) => updateField('specifications', next)}
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
