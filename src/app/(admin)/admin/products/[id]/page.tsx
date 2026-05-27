'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import WysiwygEditor from '@/components/admin/WysiwygEditor';
import SpecsEditor from '@/components/admin/SpecsEditor';
import BrandSelector from '@/components/admin/BrandSelector';
import BarcodeInput from '@/components/admin/BarcodeInput';
import ProductImagesManager from '@/components/admin/ProductImagesManager';
import RestockSuggestionHint from '@/components/admin/RestockSuggestionHint';
import VariantsSection from '@/components/admin/VariantsSection';
import WarehouseStockSection from '@/components/admin/WarehouseStockSection';
import ProductBadgesSection from '@/components/admin/ProductBadgesSection';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useUploadProgress } from '@/hooks/useUploadProgress';
import UploadProgress from '@/components/ui/UploadProgress';

interface PriceHistoryEntry {
  id: number;
  priceRetailOld: string | null;
  priceRetailNew: string | null;
  priceWholesaleOld: string | null;
  priceWholesaleNew: string | null;
  changedAt: string;
}

interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: string | number;
  priceRetailOld: string | number | null;
  priceWholesale: string | number | null;
  priceWholesale2: string | number | null;
  priceWholesale3: string | number | null;
  quantity: number;
  hideQuantity?: boolean;
  sortOrder: number;
  isActive: boolean;
  isPromo: boolean;
  promoStartDate: string | null;
  promoEndDate: string | null;
  imagePath: string | null;
  images: { id: number; pathMedium: string; sortOrder: number }[];
  categoryId: number | null;
  category?: { id: number; name: string } | null;
  brandId: number | null;
  brand?: { id: number; name: string; slug: string } | null;
  content?: {
    seoTitle: string | null;
    seoDescription: string | null;
    fullDescription: string | null;
    shortDescription: string | null;
    specifications: string | null;
    seoTitleEn: string | null;
    seoDescriptionEn: string | null;
    fullDescriptionEn: string | null;
    shortDescriptionEn: string | null;
    specificationsEn: string | null;
  } | null;
  nameEn?: string | null;
}

// All form inputs are strings (or booleans for checkboxes) because they come from
// raw HTML controls — numbers/dates get parsed at save time before the payload is
// shipped to the API.
interface ProductFormState {
  name: string;
  code: string;
  barcode: string;
  slug: string;
  description: string;
  descriptionHtml: string;
  specifications: string;
  priceRetail: string;
  priceRetailOld: string;
  priceWholesale: string;
  priceWholesale2: string;
  priceWholesale3: string;
  quantity: string;
  hideQuantity: boolean;
  sortOrder: string;
  isActive: boolean;
  isPromo: boolean;
  promoStartDate: string;
  promoEndDate: string;
  seoTitle: string;
  seoDescription: string;
  // EN translations — empty string means "no translation, fall back to uk".
  nameEn: string;
  descriptionEn: string;
  descriptionHtmlEn: string;
  specificationsEn: string;
  seoTitleEn: string;
  seoDescriptionEn: string;
  categoryId: string;
  brandId: string;
  // Physical parameters — used by carrier TTN sizing and margin reports.
  weightGrams: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  cost: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: '',
  code: '',
  barcode: '',
  slug: '',
  description: '',
  descriptionHtml: '',
  specifications: '',
  priceRetail: '',
  priceRetailOld: '',
  priceWholesale: '',
  priceWholesale2: '',
  priceWholesale3: '',
  quantity: '0',
  hideQuantity: false,
  sortOrder: '0',
  isActive: true,
  isPromo: false,
  promoStartDate: '',
  promoEndDate: '',
  seoTitle: '',
  seoDescription: '',
  nameEn: '',
  descriptionEn: '',
  descriptionHtmlEn: '',
  specificationsEn: '',
  seoTitleEn: '',
  seoDescriptionEn: '',
  categoryId: '',
  brandId: '',
  weightGrams: '',
  lengthMm: '',
  widthMm: '',
  heightMm: '',
  cost: '',
};

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState<string>('');
  const [categories, setCategories] = useState<
    { id: number; name: string; parentId: number | null }[]
  >([]);

  // Load categories once so the form can render a name-based dropdown
  useEffect(() => {
    apiClient
      .get<{ id: number; name: string; parentId: number | null }[]>('/api/v1/admin/categories')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setCategories(res.data);
      })
      .catch(() => {});
  }, []);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // Synchronous in-flight guard for the AI button. `isGenerating` flips
  // through React's async setState, so a fast double-click would fire two
  // billable Claude/Gemini calls before the disabled prop takes effect.
  const aiInFlight = useRef(false);
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini' | 'rules'>('claude');
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
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [deleteImageId, setDeleteImageId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bgRemovalAvailable, setBgRemovalAvailable] = useState(false);
  const [removeBgEnabled, setRemoveBgEnabled] = useState(true);
  const { isUploading, progress, upload: uploadWithProgress } = useUploadProgress();

  useEffect(() => {
    apiClient
      .get<{ backgroundRemoval: boolean }>('/api/v1/admin/upload/capabilities')
      .then((res) => {
        if (res.success && res.data) setBgRemovalAvailable(res.data.backgroundRemoval);
      })
      .catch(() => {});
  }, []);
  const { errors, validateAll, clearError, onBlurField } = useFormValidation({
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
    apiClient
      .get<ProductDetail>(`/api/v1/admin/products/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setProduct(res.data);
          // Description and SEO live in the joined ProductContent table, not on
          // Product itself — read from there so the form actually reflects what
          // was saved instead of always showing empty.
          // datetime-local input wants "YYYY-MM-DDTHH:mm" (no seconds, no TZ).
          const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');
          setForm({
            name: res.data.name,
            code: res.data.code,
            barcode: (res.data as { barcode?: string | null }).barcode || '',
            slug: res.data.slug,
            description: res.data.content?.shortDescription || '',
            descriptionHtml: res.data.content?.fullDescription || '',
            specifications: res.data.content?.specifications || '',
            priceRetail: String(res.data.priceRetail),
            priceRetailOld: res.data.priceRetailOld ? String(res.data.priceRetailOld) : '',
            priceWholesale: res.data.priceWholesale ? String(res.data.priceWholesale) : '',
            priceWholesale2: res.data.priceWholesale2 ? String(res.data.priceWholesale2) : '',
            priceWholesale3: res.data.priceWholesale3 ? String(res.data.priceWholesale3) : '',
            quantity: String(res.data.quantity),
            hideQuantity: !!res.data.hideQuantity,
            sortOrder: String(res.data.sortOrder ?? 0),
            isActive: res.data.isActive,
            isPromo: res.data.isPromo,
            promoStartDate: toLocalInput(res.data.promoStartDate),
            promoEndDate: toLocalInput(res.data.promoEndDate),
            seoTitle: res.data.content?.seoTitle || '',
            seoDescription: res.data.content?.seoDescription || '',
            nameEn: res.data.nameEn || '',
            descriptionEn: res.data.content?.shortDescriptionEn || '',
            descriptionHtmlEn: res.data.content?.fullDescriptionEn || '',
            specificationsEn: res.data.content?.specificationsEn || '',
            seoTitleEn: res.data.content?.seoTitleEn || '',
            seoDescriptionEn: res.data.content?.seoDescriptionEn || '',
            categoryId: res.data.categoryId ? String(res.data.categoryId) : '',
            brandId: res.data.brandId ? String(res.data.brandId) : '',
            weightGrams:
              (res.data as unknown as { weightGrams?: number | null }).weightGrams != null
                ? String((res.data as unknown as { weightGrams: number }).weightGrams)
                : '',
            lengthMm:
              (res.data as unknown as { lengthMm?: number | null }).lengthMm != null
                ? String((res.data as unknown as { lengthMm: number }).lengthMm)
                : '',
            widthMm:
              (res.data as unknown as { widthMm?: number | null }).widthMm != null
                ? String((res.data as unknown as { widthMm: number }).widthMm)
                : '',
            heightMm:
              (res.data as unknown as { heightMm?: number | null }).heightMm != null
                ? String((res.data as unknown as { heightMm: number }).heightMm)
                : '',
            cost:
              (res.data as unknown as { cost?: number | string | null }).cost != null
                ? String((res.data as unknown as { cost: number | string }).cost)
                : '',
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  // Capture a snapshot of the form right after it loads, then re-snapshot
  // after each successful save so the "unsaved changes" indicator clears.
  useEffect(() => {
    if (!isLoading && product && !savedFormSnapshot) {
      setSavedFormSnapshot(JSON.stringify(form));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, product]);
  const isDirty = savedFormSnapshot !== '' && JSON.stringify(form) !== savedFormSnapshot;
  const guardDirty = useUnsavedChangesGuard(isDirty);

  const updateField = useCallback(
    <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = async () => {
    if (!validateAll(form)) return;
    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        barcode: form.barcode.trim() || null,
        slug: form.slug || null,
        description: form.description || null,
        descriptionHtml: form.descriptionHtml || null,
        specifications: form.specifications || null,
        priceRetail: Number(form.priceRetail),
        priceRetailOld: form.priceRetailOld ? Number(form.priceRetailOld) : null,
        priceWholesale: form.priceWholesale ? Number(form.priceWholesale) : null,
        priceWholesale2: form.priceWholesale2 ? Number(form.priceWholesale2) : null,
        priceWholesale3: form.priceWholesale3 ? Number(form.priceWholesale3) : null,
        quantity: Number(form.quantity),
        hideQuantity: form.hideQuantity,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        isPromo: form.isPromo,
        promoStartDate: form.promoStartDate || null,
        promoEndDate: form.promoEndDate || null,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        // EN — send the raw string so service can null-out empties.
        nameEn: form.nameEn || null,
        descriptionEn: form.descriptionEn || null,
        descriptionHtmlEn: form.descriptionHtmlEn || null,
        specificationsEn: form.specificationsEn || null,
        seoTitleEn: form.seoTitleEn || null,
        seoDescriptionEn: form.seoDescriptionEn || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        brandId: form.brandId ? Number(form.brandId) : null,
        weightGrams: form.weightGrams ? Number(form.weightGrams) : null,
        lengthMm: form.lengthMm ? Number(form.lengthMm) : null,
        widthMm: form.widthMm ? Number(form.widthMm) : null,
        heightMm: form.heightMm ? Number(form.heightMm) : null,
        cost: form.cost ? Number(form.cost) : null,
        // Optimistic concurrency token: server checks this matches the row's
        // current version and atomically increments. Mismatch → 409.
        version: (product as { version?: number } | null)?.version,
      };
      const res = await apiClient.put<ProductDetail>(`/api/v1/admin/products/${id}`, payload);
      if (res.success && res.data) {
        toast.success('Збережено!');
        // Sync the local product (so `product.version` advances) and clear
        // the dirty snapshot.
        setProduct(res.data);
        setSavedFormSnapshot(JSON.stringify(form));
      } else if (res.statusCode === 409) {
        // Optimistic-lock conflict. Offer to refresh from server so the admin
        // doesn't lose unsaved input — they can copy fields from the toast
        // before clicking "Оновити", or override after refresh.
        toast.error(res.error || 'Товар був змінений іншим адміністратором', {
          duration: 12000,
          action: {
            label: 'Оновити з сервера',
            onClick: async () => {
              const updated = await apiClient.get<ProductDetail>(`/api/v1/admin/products/${id}`);
              if (updated.success && updated.data) {
                setProduct(updated.data);
                toast.success('Оновлено. Поверніть свої правки і збережіть знову.');
              }
            },
          },
        });
      } else {
        toast.error(res.error || 'Помилка збереження');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setIsSaving(false);
    }
  };

  /** Generate description+SEO via AI based on current form data. Confirms
   * before overwriting non-empty fields so the manager doesn't lose edits. */
  const handleAiGenerate = async () => {
    if (!form.name.trim()) {
      toast.error('Спершу введіть назву товару');
      return;
    }
    const hasExisting =
      form.descriptionHtml.trim() ||
      form.description.trim() ||
      form.seoTitle.trim() ||
      form.seoDescription.trim();
    if (hasExisting && !window.confirm('Замінити існуючий опис/SEO?')) return;
    if (aiInFlight.current) return;
    aiInFlight.current = true;

    setIsGenerating(true);
    try {
      const res = await apiClient.post<{
        seoTitle: string;
        seoDescription: string;
        shortDescription: string;
        fullDescription: string;
      }>('/api/v1/admin/products/ai-generate-preview', {
        name: form.name.trim(),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        brandId: form.brandId ? Number(form.brandId) : null,
        priceRetail: Number(form.priceRetail) || 0,
        shortDescription: form.description.trim() || null,
        provider: aiProvider,
      });
      if (res.success && res.data) {
        setForm((prev) => ({
          ...prev,
          description: res.data!.shortDescription,
          descriptionHtml: res.data!.fullDescription,
          seoTitle: res.data!.seoTitle,
          seoDescription: res.data!.seoDescription,
        }));
        toast.success(`AI згенерував опис (${aiProvider})`);
      } else {
        toast.error(res.error || 'AI генерація не вдалась');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      aiInFlight.current = false;
      setIsGenerating(false);
    }
  };

  const handleImageUpload = async (files: FileList) => {
    if (!files?.length) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }
    if (bgRemovalAvailable && removeBgEnabled) {
      formData.append('removeBg', 'true');
    }

    try {
      const result = (await uploadWithProgress(
        `/api/v1/admin/products/${id}/images`,
        formData,
      )) as { success?: boolean; error?: string };
      if (result?.success) {
        const updated = await apiClient.get<ProductDetail>(`/api/v1/admin/products/${id}`);
        if (updated.success && updated.data) setProduct(updated.data);
        toast.success('Зображення завантажено');
      } else {
        toast.error(result?.error || 'Не вдалося завантажити зображення');
      }
    } catch {
      toast.error('Помилка мережі при завантаженні');
    }
  };

  const executeDeleteImage = async () => {
    if (deleteImageId === null) return;
    const imageId = deleteImageId;
    setDeleteImageId(null);
    try {
      const res = await apiClient.delete(`/api/v1/admin/products/${id}/images/${imageId}`);
      if (res.success && product) {
        setProduct({ ...product, images: product.images.filter((img) => img.id !== imageId) });
        toast.success('Зображення видалено');
      } else {
        toast.error(res.error || 'Не вдалося видалити зображення');
      }
    } catch {
      toast.error('Помилка мережі при видаленні зображення');
    }
  };

  const handleDeleteProduct = async () => {
    setConfirmDelete(false);
    setIsDeleting(true);
    try {
      const res = await apiClient.delete(`/api/v1/admin/products/${id}`);
      if (res.success) {
        toast.success('Товар видалено');
        router.push('/admin/products');
      } else {
        toast.error(res.error || 'Не вдалося видалити товар');
      }
    } catch {
      toast.error('Помилка видалення');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">Товар не знайдено</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/products')}>
          До списку
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/products"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Товари
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">{product.name}</h2>
          {isDirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Незбережені зміни
            </span>
          )}
          <a
            href={`/product/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            title="Переглянути на сайті"
          >
            ↗ На сайті
          </a>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          ID: {product.id} | Код: {product.code}
        </p>
      </div>

      {/* Images */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 text-sm font-semibold">Зображення</h3>
        <ProductImagesManager
          productId={id}
          images={product.images}
          onChange={(next) => setProduct({ ...product, images: next })}
          isUploading={isUploading}
          onUpload={handleImageUpload}
          onRequestDelete={(imageId) => setDeleteImageId(imageId)}
        />
        {bgRemovalAvailable && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeBgEnabled}
              onChange={(e) => setRemoveBgEnabled(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            <span>
              Автоматично видалити фон при завантаженні
              <span className="ml-1 text-xs text-[var(--color-text-secondary)]">
                (товар автоматично розмішується на фоні сайту)
              </span>
            </span>
          </label>
        )}
        <UploadProgress progress={progress} isUploading={isUploading} />
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
            onBlur={onBlurField('name', form)}
            error={errors.name}
          />
          <Input
            label="Код *"
            value={form.code}
            onChange={(e) => {
              updateField('code', e.target.value);
              clearError('code');
            }}
            onBlur={onBlurField('code', form)}
            error={errors.code}
          />
          <BarcodeInput value={form.barcode} onChange={(v) => updateField('barcode', v)} />
          <div>
            <Input
              label="Slug (URL)"
              value={form.slug}
              onChange={(e) => updateField('slug', e.target.value)}
              placeholder="auto-generated from name"
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              pulito.trade/product/<strong>{form.slug || '...'}</strong>
              {product && product.slug && form.slug !== product.slug && (
                <span className="ml-1 font-medium text-amber-600">
                  ⚠️ Зміна URL поверне 404 на старій адресі
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Категорія
            </label>
            <Select
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              options={[
                { value: '', label: '— Без категорії —' },
                ...categories.map((c) => ({
                  value: String(c.id),
                  label: c.parentId ? `↳ ${c.name}` : c.name,
                })),
              ]}
            />
            {!form.categoryId && (
              <p className="mt-1 text-[11px] text-amber-600">
                ⚠️ Товар без категорії не з&apos;явиться в каталозі на сайті
              </p>
            )}
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
            onBlur={onBlurField('priceRetail', form)}
            error={errors.priceRetail}
          />
          <div>
            <Input
              label="Стара ціна"
              type="number"
              min="0"
              step="0.01"
              value={form.priceRetailOld}
              onChange={(e) => updateField('priceRetailOld', e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Заповніть, щоб показати знижку −% на товарі
            </p>
          </div>
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
          <div>
            <Input
              label="Кількість *"
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => {
                updateField('quantity', e.target.value);
                clearError('quantity');
              }}
              onBlur={onBlurField('quantity', form)}
              error={errors.quantity}
            />
            <RestockSuggestionHint
              productId={Number(id)}
              onApply={(qty) => updateField('quantity', String(qty))}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={form.hideQuantity}
                onChange={(e) => updateField('hideQuantity', e.target.checked)}
              />
              Приховувати кількість на сайті (показувати тільки «В наявності»)
            </label>
          </div>
          <div>
            <Input
              label="Сортування"
              type="number"
              value={form.sortOrder}
              onChange={(e) => updateField('sortOrder', e.target.value)}
              placeholder="0"
            />
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Менше число — вище в списку каталогу
            </p>
          </div>
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
        <BrandSelector value={form.brandId || ''} onChange={(v) => updateField('brandId', v)} />
      </div>

      {/* Description */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-3 flex items-center justify-between">
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
              disabled={isGenerating}
              onClick={async () => {
                if (aiInFlight.current) return;
                aiInFlight.current = true;
                setIsGenerating(true);
                try {
                  const res = await apiClient.post<{
                    seoTitle: string;
                    seoDescription: string;
                    shortDescription: string;
                    fullDescription: string;
                  }>(`/api/v1/admin/products/${id}/ai-generate`, { provider: aiProvider });
                  if (!res.success || !res.data) {
                    toast.error(res.error || 'Не вдалося згенерувати');
                    return;
                  }
                  // Detect which fields already have content — ask before overwriting
                  const conflicts: string[] = [];
                  if (form.seoTitle.trim()) conflicts.push('SEO Title');
                  if (form.seoDescription.trim()) conflicts.push('SEO Description');
                  if (form.description.trim()) conflicts.push('Короткий опис');
                  if (form.descriptionHtml.trim()) conflicts.push('Повний опис');
                  if (
                    conflicts.length > 0 &&
                    !window.confirm(
                      `Замінити вже заповнені поля?\n\n${conflicts.join(', ')}\n\nOK — замінити, Cancel — лишити як є.`,
                    )
                  ) {
                    // User refused — only fill empty fields
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
                  toast.success('Згенеровано — перевірте поля Опис і SEO');
                } catch (err) {
                  console.error('[AI generate]', err);
                  toast.error('Помилка мережі');
                } finally {
                  aiInFlight.current = false;
                  setIsGenerating(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
              title="Згенерувати SEO-опис на основі назви, бренду, категорії"
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
        <WysiwygEditor
          value={form.descriptionHtml}
          onChange={(html) => updateField('descriptionHtml', html)}
          placeholder="Введіть опис товару..."
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

      {/* Badges */}
      <ProductBadgesSection productId={Number(id)} />

      {/* Variants */}
      <VariantsSection productId={Number(id)} />

      {/* Warehouse-level stock */}
      <WarehouseStockSection productId={Number(id)} />

      {/* Price History */}
      <PriceHistorySection productId={Number(id)} />

      {/* Marketplaces */}
      <ProductMarketplacesSection productId={Number(id)} />

      {/* Physical parameters — weight, dimensions, cost-of-goods */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Фізичні параметри</h3>
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            Використовується для TTN Нової Пошти та розрахунку маржі
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Вага (г)"
            type="number"
            value={form.weightGrams}
            onChange={(e) => updateField('weightGrams', e.target.value)}
            placeholder="300"
          />
          <Input
            label="Довжина (мм)"
            type="number"
            value={form.lengthMm}
            onChange={(e) => updateField('lengthMm', e.target.value)}
            placeholder="200"
          />
          <Input
            label="Ширина (мм)"
            type="number"
            value={form.widthMm}
            onChange={(e) => updateField('widthMm', e.target.value)}
            placeholder="150"
          />
          <Input
            label="Висота (мм)"
            type="number"
            value={form.heightMm}
            onChange={(e) => updateField('heightMm', e.target.value)}
            placeholder="100"
          />
          <Input
            label="Собівартість (₴)"
            type="number"
            step="0.01"
            value={form.cost}
            onChange={(e) => updateField('cost', e.target.value)}
            placeholder="0.00"
          />
        </div>
        {form.cost && form.priceRetail && Number(form.cost) > 0 && Number(form.priceRetail) > 0 && (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Маржа:{' '}
            <strong
              className={
                ((Number(form.priceRetail) - Number(form.cost)) / Number(form.priceRetail)) * 100 <
                10
                  ? 'text-red-600'
                  : ((Number(form.priceRetail) - Number(form.cost)) / Number(form.priceRetail)) *
                        100 <
                      25
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }
            >
              {Math.round(
                ((Number(form.priceRetail) - Number(form.cost)) / Number(form.priceRetail)) * 1000,
              ) / 10}
              %
            </strong>{' '}
            ({(Number(form.priceRetail) - Number(form.cost)).toFixed(2)} ₴ з одиниці)
          </p>
        )}
      </div>

      {/* SEO */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">SEO</h3>
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={isGenerating || !form.name.trim()}
            className="inline-flex items-center gap-1 rounded border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20 disabled:opacity-50"
            title={
              !form.name.trim() ? 'Введіть назву товару спершу' : 'Згенерувати опис та SEO через AI'
            }
          >
            {isGenerating ? '⏳ Генерую...' : '✨ Згенерувати AI'}
          </button>
        </div>
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
              {form.seoTitle?.length || 0}/70
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
              {form.seoDescription?.length || 0}/160
            </p>
          </div>
        </div>
      </div>

      {/* EN translations — optional. Empty fields fall back to uk on /en/. */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span className="rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
            EN
          </span>
          Англійський переклад (опційно)
        </h3>
        <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
          Залиште порожнім — на /en/ покаже українську версію як фолбек.
        </p>
        <div className="space-y-4">
          <Input
            label="Name (EN)"
            value={form.nameEn}
            onChange={(e) => updateField('nameEn', e.target.value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Short description (EN)</label>
            <textarea
              value={form.descriptionEn}
              onChange={(e) => updateField('descriptionEn', e.target.value)}
              rows={2}
              maxLength={200}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {form.descriptionEn?.length || 0}/200
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Full description (EN, HTML)</label>
            <textarea
              value={form.descriptionHtmlEn}
              onChange={(e) => updateField('descriptionHtmlEn', e.target.value)}
              rows={6}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Specifications (EN)</label>
            <textarea
              value={form.specificationsEn}
              onChange={(e) => updateField('specificationsEn', e.target.value)}
              rows={4}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <Input
            label="SEO Title (EN)"
            value={form.seoTitleEn}
            onChange={(e) => updateField('seoTitleEn', e.target.value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium">SEO Description (EN)</label>
            <textarea
              value={form.seoDescriptionEn}
              onChange={(e) => updateField('seoDescriptionEn', e.target.value)}
              rows={3}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} isLoading={isSaving}>
          Зберегти зміни
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const title = encodeURIComponent(`Новинка: ${product.name}`);
            const price = Number(product.priceRetail).toFixed(0);
            const content = encodeURIComponent(
              `${product.name}\n\nЦіна: ${price} грн\nЗамовляйте прямо зараз!`,
            );
            const image = encodeURIComponent(product.imagePath || '');
            guardDirty(() =>
              router.push(
                `/admin/publications?prefill=product&title=${title}&content=${content}&image=${image}&productId=${product.id}`,
              ),
            );
          }}
        >
          Опублікувати в соцмережі
        </Button>
        <Button variant="outline" onClick={() => guardDirty(() => router.push('/admin/products'))}>
          Скасувати
        </Button>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isDeleting}
            className="rounded-[var(--radius)] border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? 'Видалення…' : 'Видалити товар'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteImageId !== null}
        onClose={() => setDeleteImageId(null)}
        onConfirm={executeDeleteImage}
        variant="danger"
        message="Видалити зображення?"
      />

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteProduct}
        variant="danger"
        title="Видалення товару"
        message={`Ви впевнені, що хочете видалити "${product.name}"? Товар буде деактивовано та позначено як видалений.`}
        confirmText="Так, видалити"
      />
    </div>
  );
}

interface ProductMarketplaceRow {
  channel: string;
  status: string;
  externalId: string | null;
  permalink: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  publicationId: number | null;
  configured: boolean;
  excluded: boolean;
}

const MARKETPLACE_LABELS: Record<string, { name: string; icon: string }> = {
  olx: { name: 'OLX', icon: '🟢' },
  rozetka: { name: 'Rozetka', icon: '🟩' },
  prom: { name: 'Prom.ua', icon: '🔵' },
  epicentrk: { name: 'Epicentr K', icon: '🟠' },
};

function ProductMarketplacesSection({ productId }: { productId: number }) {
  const [rows, setRows] = useState<ProductMarketplaceRow[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [confirmUnpublish, setConfirmUnpublish] = useState<string | null>(null);
  // Derive isLoading from request/completion tokens to avoid synchronous setState in effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [completedToken, setCompletedToken] = useState(-1);
  const isLoading = completedToken !== reloadToken;
  const load = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ProductMarketplaceRow[]>(`/api/v1/admin/products/${productId}/marketplaces`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setRows(res.data);
        setCompletedToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, reloadToken]);

  const handlePublish = async (channel: string) => {
    setBusy((prev) => ({ ...prev, [channel]: true }));
    const res = await apiClient.post(`/api/v1/admin/products/${productId}/marketplaces`, {
      channel,
    });
    if (res.success) {
      toast.success(`Опубліковано на ${MARKETPLACE_LABELS[channel]?.name || channel}`);
      load();
    } else {
      toast.error(res.error || 'Не вдалося опублікувати');
    }
    setBusy((prev) => ({ ...prev, [channel]: false }));
  };

  const toggleExclusion = async (channel: string, excluded: boolean) => {
    setBusy((prev) => ({ ...prev, [channel]: true }));
    const res = await apiClient.patch(`/api/v1/admin/products/${productId}/marketplaces`, {
      channel,
      excluded,
    });
    if (res.success) {
      toast.success(excluded ? 'Виключено' : 'Дозволено');
      load();
    } else {
      toast.error(res.error || 'Не вдалося оновити');
    }
    setBusy((prev) => ({ ...prev, [channel]: false }));
  };

  const executeUnpublish = async () => {
    const channel = confirmUnpublish;
    if (!channel) return;
    setConfirmUnpublish(null);
    setBusy((prev) => ({ ...prev, [channel]: true }));
    try {
      const res = await apiClient.delete(
        `/api/v1/admin/products/${productId}/marketplaces?channel=${encodeURIComponent(channel)}`,
      );
      if (res.success) {
        toast.success('Знято з продажу');
        load();
      } else {
        toast.error(res.error || 'Не вдалося зняти');
      }
    } catch {
      toast.error('Помилка мережі');
    } finally {
      setBusy((prev) => ({ ...prev, [channel]: false }));
    }
  };

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Маркетплейси</h3>
        <Link
          href="/admin/marketplaces"
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          Налаштування →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const label = MARKETPLACE_LABELS[row.channel] || { name: row.channel, icon: '📦' };
            const isPublished = row.status === 'published' && row.externalId;
            const isFailed = row.status === 'failed';

            return (
              <div
                key={row.channel}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
              >
                <span>{label.icon}</span>
                <span className="font-medium">{label.name}</span>
                {!row.configured ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    Не налашт.
                  </span>
                ) : isPublished ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    ✓ Опубліковано
                  </span>
                ) : isFailed ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    ✗ Помилка
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    —
                  </span>
                )}
                {row.permalink && (
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    Переглянути ↗
                  </a>
                )}
                {row.errorMessage && (
                  <span
                    title={row.errorMessage}
                    className="ml-1 max-w-xs truncate text-xs text-red-600"
                  >
                    {row.errorMessage}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  {row.excluded && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Виключено
                    </span>
                  )}
                  {!row.configured ? (
                    <Link
                      href="/admin/marketplaces"
                      className="rounded-md bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
                    >
                      Налаштувати →
                    </Link>
                  ) : (
                    <button
                      onClick={() => toggleExclusion(row.channel, !row.excluded)}
                      disabled={busy[row.channel]}
                      className="text-xs text-[var(--color-text-secondary)] hover:underline disabled:opacity-50"
                      title={
                        row.excluded
                          ? 'Дозволити публікацію на цьому маркетплейсі'
                          : 'Виключити з цього маркетплейсу (не публікувати в bulk/sync)'
                      }
                    >
                      {row.excluded ? 'Дозволити' : 'Виключити'}
                    </button>
                  )}
                  {row.configured && !isPublished && !row.excluded && (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={busy[row.channel]}
                      disabled={busy[row.channel]}
                      onClick={() => handlePublish(row.channel)}
                    >
                      Опублікувати
                    </Button>
                  )}
                  {isPublished && (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={busy[row.channel]}
                      disabled={busy[row.channel]}
                      onClick={() => setConfirmUnpublish(row.channel)}
                    >
                      Зняти
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmUnpublish !== null}
        onClose={() => setConfirmUnpublish(null)}
        onConfirm={executeUnpublish}
        variant="warning"
        title="Зняття з маркетплейсу"
        message={
          confirmUnpublish
            ? `Зняти товар з ${MARKETPLACE_LABELS[confirmUnpublish]?.name || confirmUnpublish}?`
            : ''
        }
        confirmText="Так, зняти"
      />
    </div>
  );
}

function PriceHistorySection({ productId }: { productId: number }) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setIsLoading(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    apiClient
      .get<PriceHistoryEntry[]>(`/api/v1/admin/products/${productId}/price-history`)
      .then((res) => {
        if (!cancelled && res.success && res.data) setHistory(res.data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, productId]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatPrice = (v: string | null) => (v ? `${Number(v).toFixed(2)} ₴` : '—');

  return (
    <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <button
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className="flex w-full items-center justify-between text-sm font-semibold"
      >
        <span>Історія цін</span>
        <span className="text-[var(--color-text-secondary)]">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Змін цін не зафіксовано</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Дата</th>
                    <th className="px-3 py-2 text-right font-medium">Роздріб (було)</th>
                    <th className="px-3 py-2 text-right font-medium">Роздріб (стало)</th>
                    <th className="px-3 py-2 text-right font-medium">Опт (було)</th>
                    <th className="px-3 py-2 text-right font-medium">Опт (стало)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2">{formatDate(h.changedAt)}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(h.priceRetailOld)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatPrice(h.priceRetailNew)}
                      </td>
                      <td className="px-3 py-2 text-right">{formatPrice(h.priceWholesaleOld)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatPrice(h.priceWholesaleNew)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
