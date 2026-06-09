'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Trash, Check, Close, Eye } from '@/components/icons';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/config/admin-constants';
import { sanitizeHtml } from '@/utils/sanitize';
import Image from 'next/image';

interface ChannelResult {
  id: number;
  channel: string;
  status: string;
  externalId: string | null;
  permalink: string | null;
  errorMessage: string | null;
  retryCount: number;
  publishedAt: string | null;
  views: number | null;
  clicks: number | null;
  engagement: number | null;
}

interface Publication {
  id: number;
  title: string;
  content: string;
  channels: string[];
  hashtags: string | null;
  channelContents: Record<string, ChannelContent> | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  creator: { fullName: string };
  channelResults?: ChannelResult[];
}

interface ChannelContent {
  title: string;
  content: string;
  hashtags: string;
}

interface EditForm {
  title: string;
  content: string;
  channels: string[];
  hashtags: string;
  scheduledAt: string;
}

type ViewMode = 'list' | 'calendar';

interface PublicationTemplate {
  label: string;
  title: string;
  content: string;
  hashtags: string;
  channels: string[];
}

const ALL_CHANNELS = [
  { key: 'telegram', label: 'Telegram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'olx', label: 'OLX' },
  { key: 'rozetka', label: 'Rozetka' },
  { key: 'prom', label: 'Prom.ua' },
  { key: 'epicentrk', label: 'Epicentr K' },
  { key: 'site', label: 'Site' },
] as const;

function ChannelCheckboxes({
  channels,
  onChange,
}: {
  channels: string[];
  onChange: (ch: string) => void;
}) {
  const t = useTranslations('admin.publicationsPage');
  return (
    <div className="mt-1 flex flex-wrap gap-3">
      {ALL_CHANNELS.map((ch) => (
        <label key={ch.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={channels.includes(ch.key)}
            onChange={() => onChange(ch.key)}
            className="accent-[var(--color-primary)]"
          />
          {ch.key === 'site' ? t('channelSite') : ch.label}
        </label>
      ))}
    </div>
  );
}

export default function AdminPublicationsPage() {
  const t = useTranslations('admin.publicationsPage');
  const channelLabel = useCallback(
    (ch: string) =>
      ch === 'site' ? t('channelSite') : ALL_CHANNELS.find((c) => c.key === ch)?.label || ch,
    [t],
  );
  const PUBLICATION_TEMPLATES: PublicationTemplate[] = useMemo(
    () => [
      {
        label: t('tpl_new_label'),
        title: t('tpl_new_title'),
        content: t('tpl_new_content'),
        hashtags: '#новинка #pulito_trade #новийтовар',
        channels: ['telegram', 'facebook', 'tiktok', 'site'],
      },
      {
        label: t('tpl_promo_label'),
        title: t('tpl_promo_title'),
        content: t('tpl_promo_content'),
        hashtags: '#акція #знижка #pulito_trade',
        channels: ['telegram', 'facebook', 'tiktok'],
      },
      {
        label: t('tpl_news_label'),
        title: t('tpl_news_title'),
        content: t('tpl_news_content'),
        hashtags: '#новини #pulito_trade',
        channels: ['telegram', 'facebook', 'site'],
      },
    ],
    [t],
  );
  const TEMPLATE_VARS = useMemo(
    () =>
      [
        { key: '{{product.name}}', label: t('var_name') },
        { key: '{{product.price}}', label: t('var_price') },
        { key: '{{product.oldPrice}}', label: t('var_oldPrice') },
        { key: '{{product.code}}', label: t('var_code') },
        { key: '{{product.url}}', label: t('var_url') },
        { key: '{{product.discount}}', label: t('var_discount') },
      ] as const,
    [t],
  );
  const [publications, setPublications] = useState<Publication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    channels: ['telegram'] as string[],
    hashtags: '',
    scheduledAt: '',
    imagePath: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChannelContents, setShowChannelContents] = useState(false);
  const [channelContents, setChannelContents] = useState<Record<string, ChannelContent>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    title: '',
    content: '',
    channels: [],
    hashtags: '',
    scheduledAt: '',
  });
  const [previewPub, setPreviewPub] = useState<Publication | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [publishConfirmId, setPublishConfirmId] = useState<number | null>(null);
  const [testPub, setTestPub] = useState<{ id: number; channel: string } | null>(null);
  const [testResult, setTestResult] = useState<{
    channel: string;
    title: string;
    content: string;
    hashtags?: string | null;
    imagePath?: string | null;
    note?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const searchParams = useSearchParams();

  // Prefill from query params (e.g., from product page)
  useEffect(() => {
    if (searchParams.get('prefill')) {
      const title = searchParams.get('title') || '';
      const content = searchParams.get('content') || '';
      const image = searchParams.get('image') || '';
      setForm({
        title,
        content,
        channels: ['telegram', 'facebook', 'tiktok'],
        hashtags: '#pulito_trade',
        scheduledAt: '',
        imagePath: image,
      });
      setShowForm(true);
    }
  }, [searchParams]);

  const applyTemplate = (tpl: PublicationTemplate) => {
    setForm({
      title: tpl.title,
      content: tpl.content,
      channels: [...tpl.channels],
      hashtags: tpl.hashtags,
      scheduledAt: '',
      imagePath: '',
    });
  };

  const loadPublications = async () => {
    const res = await apiClient.get<Publication[]>('/api/v1/admin/publications').catch(() => {
      toast.error(t('loadError'));
      return null;
    });
    if (res?.success && res.data) setPublications(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      const res = await apiClient.get<Publication[]>('/api/v1/admin/publications');
      if (res.success && res.data) setPublications(res.data);
      setIsLoading(false);
    };
    load();
  }, []);

  const [imageUploading, setImageUploading] = useState(false);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [useWatermark, setUseWatermark] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'promo' | 'new'>('all');
  const [productResults, setProductResults] = useState<
    {
      id: number;
      name: string;
      code: string;
      priceRetail: number;
      priceRetailOld: number | null;
      isPromo: boolean;
      imagePath: string | null;
      slug: string;
    }[]
  >([]);
  const [productSearching, setProductSearching] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const searchProducts = async (query: string, filter: 'all' | 'promo' | 'new') => {
    setProductSearching(true);
    const params = new URLSearchParams({ limit: '10' });
    if (query) params.set('search', query);
    if (filter === 'promo') params.set('isPromo', 'true');
    if (filter === 'new') params.set('sortBy', 'createdAt');
    const res = await apiClient.get<
      {
        id: number;
        name: string;
        code: string;
        priceRetail: number;
        priceRetailOld: number | null;
        isPromo: boolean;
        imagePath: string | null;
        slug: string;
      }[]
    >(`/api/v1/admin/products?${params}`);
    if (res.success && res.data) setProductResults(res.data);
    setProductSearching(false);
  };

  const debouncedProductSearch = useDebounce(productSearch, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (showProductPicker) searchProducts(debouncedProductSearch, productFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedProductSearch, productFilter]);

  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);

  const toggleBulkSelect = (id: number) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkPublish = async () => {
    if (bulkSelected.size === 0) return;
    setBulkPublishing(true);
    const selectedProducts = productResults.filter((p) => bulkSelected.has(p.id));
    const channels = ['telegram', 'facebook', 'tiktok'];

    for (const p of selectedProducts) {
      const priceText = p.priceRetailOld
        ? t('priceOldNew', { old: p.priceRetailOld, new: p.priceRetail })
        : t('priceOnly', { price: p.priceRetail });
      const title = p.isPromo ? t('promoTitle', { name: p.name }) : p.name;
      const content = p.isPromo
        ? t('promoContent', { name: p.name, priceText })
        : t('regularContent', { name: p.name, priceText });

      const data: Record<string, unknown> = {
        title,
        content,
        channels,
        hashtags: p.isPromo ? t('hashtagsPromo') : t('hashtagsDefault'),
        imagePath: p.imagePath || undefined,
        productId: p.id,
      };

      const createRes = await apiClient.post<{ id: number }>('/api/v1/admin/publications', data);
      if (createRes.success && createRes.data) {
        const pubRes = await apiClient.post(
          `/api/v1/admin/publications/${createRes.data.id}/publish`,
        );
        if (!pubRes.success) toast.error(pubRes.error || t('pubFailedFor', { name: p.name }));
      } else {
        toast.error(createRes.error || t('pubCreateFailedFor', { name: p.name }));
      }
    }

    toast.success(t('bulkDone'));
    setBulkPublishing(false);
    setBulkSelected(new Set());
    setShowProductPicker(false);
    loadPublications();
  };

  const selectProduct = (p: {
    id: number;
    name: string;
    code: string;
    priceRetail: number;
    priceRetailOld: number | null;
    isPromo: boolean;
    imagePath: string | null;
    slug: string;
  }) => {
    const priceText = p.priceRetailOld
      ? t('priceOldNew', { old: p.priceRetailOld, new: p.priceRetail })
      : t('priceOnly', { price: p.priceRetail });
    const title = p.isPromo ? t('promoTitle', { name: p.name }) : `${p.name}`;
    const content = p.isPromo
      ? t('promoContent', { name: p.name, priceText })
      : t('regularContent', { name: p.name, priceText });
    const channels = p.isPromo
      ? ['telegram', 'facebook', 'tiktok']
      : ['telegram', 'facebook', 'tiktok', 'site'];
    const hashtags = p.isPromo ? t('hashtagsPromo') : t('hashtagsNew');
    const productUrl = `/product/${p.slug}`;
    const discount = p.priceRetailOld
      ? Math.round((1 - p.priceRetail / p.priceRetailOld) * 100)
      : 0;

    setForm({
      title,
      content,
      channels,
      hashtags,
      scheduledAt: '',
      imagePath: p.imagePath || '',
    });

    // Auto-generate per-channel content
    const shortContent = p.isPromo
      ? t('shortPromo', { name: p.name, discount, price: p.priceRetail })
      : t('shortRegular', { name: p.name, price: p.priceRetail });
    setChannelContents({
      tiktok: {
        title: p.name,
        content: shortContent,
        hashtags: t('tiktokHashtags', { base: hashtags }),
      },
      instagram: {
        title: '',
        content: t('igContent', { content }),
        hashtags: t('igHashtags', { base: hashtags }),
      },
      facebook: { title: '', content: t('fbContent', { content, url: productUrl }), hashtags },
    });
    setShowChannelContents(true);
    setShowProductPicker(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'publications');
    const res = await apiClient.upload<{ path: string }>('/api/v1/admin/upload', fd);
    if (res.success && res.data) {
      setForm((f) => ({ ...f, imagePath: res.data!.path }));
    } else {
      toast.error(res.error || t('imageUploadError'));
    }
    setImageUploading(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error(t('enterTitle'));
      return;
    }
    if (!form.content.trim()) {
      toast.error(t('addContent'));
      return;
    }
    if (!form.channels || form.channels.length === 0) {
      toast.error(t('selectChannel'));
      return;
    }
    if (form.scheduledAt) {
      const d = new Date(form.scheduledAt);
      if (Number.isNaN(d.getTime())) {
        toast.error(t('invalidScheduleDate'));
        return;
      }
      if (d <= new Date()) {
        toast.error(t('scheduleFuture'));
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const data: Record<string, unknown> = { ...form };
      if (!form.scheduledAt) delete data.scheduledAt;
      if (!form.imagePath) delete data.imagePath;
      // Include per-channel content overrides (only non-empty ones)
      const filteredCC: Record<string, ChannelContent> = {};
      for (const [ch, cc] of Object.entries(channelContents)) {
        if (cc.title || cc.content || cc.hashtags) filteredCC[ch] = cc;
      }
      if (Object.keys(filteredCC).length > 0) data.channelContents = filteredCC;
      if (additionalImages.length > 0) data.additionalImages = additionalImages;
      if (useWatermark && form.imagePath) data.applyWatermark = true;
      const res = await apiClient.post('/api/v1/admin/publications', data);
      if (res.success) {
        toast.success(t('pubCreated'));
        setShowForm(false);
        setForm({
          title: '',
          content: '',
          channels: ['telegram'],
          hashtags: '',
          scheduledAt: '',
          imagePath: '',
        });
        setChannelContents({});
        setShowChannelContents(false);
        setAdditionalImages([]);
        loadPublications();
      } else {
        toast.error(res.error || t('pubCreateError'));
      }
    } catch {
      toast.error(t('pubCreateError'));
    }
    setIsSubmitting(false);
  };

  const handlePublish = async (id: number) => {
    const res = await apiClient.post(`/api/v1/admin/publications/${id}/publish`);
    if (res.success) toast.success(t('pubPublished'));
    else toast.error(res.error || t('pubError'));
    loadPublications();
  };

  const handleRetry = async (id: number, channel: string) => {
    const res = await apiClient.post(`/api/v1/admin/publications/${id}/retry`, { channel });
    if (res.success) toast.success(t('retryStarted'));
    else toast.error(res.error || t('retryError'));
    loadPublications();
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    const res = await apiClient.delete(`/api/v1/admin/publications/${id}`);
    if (res.success) toast.success(t('pubDeleted'));
    else toast.error(res.error || t('deleteError'));
    loadPublications();
  };

  const startEdit = (p: Publication) => {
    setEditingId(p.id);
    setEditForm({
      title: p.title,
      content: p.content,
      channels: p.channels,
      hashtags: p.hashtags || '',
      scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 16) : '',
    });
  };

  const saveEdit = async (id: number) => {
    const data: Record<string, unknown> = { ...editForm };
    if (!editForm.scheduledAt) {
      data.scheduledAt = null;
    }
    try {
      const res = await apiClient.put(`/api/v1/admin/publications/${id}`, data);
      if (res.success) {
        toast.success(t('saved'));
        setEditingId(null);
        loadPublications();
      } else {
        toast.error(res.error || t('saveError'));
      }
    } catch {
      toast.error(t('networkError'));
    }
  };

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleString('uk-UA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const toggleChannel = (channels: string[], ch: string) =>
    channels.includes(ch) ? channels.filter((c) => c !== ch) : [...channels, ch];

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: t('statusDraft'),
      scheduled: t('statusScheduled'),
      published: t('statusPublished'),
      partial: t('statusPartial'),
      failed: t('statusFailed'),
      error: t('statusFailed'),
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === 'published') return 'bg-green-100 text-green-700';
    if (s === 'scheduled') return 'bg-blue-100 text-blue-700';
    if (s === 'partial') return 'bg-amber-100 text-amber-700';
    if (s === 'failed' || s === 'error') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-500';
  };

  /* ---------- Calendar helpers ---------- */
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIdx = calendarMonth.getMonth();
  const daysInMonth = new Date(calendarYear, calendarMonthIdx + 1, 0).getDate();
  // Monday = 0 … Sunday = 6
  const firstDayOfWeek = (new Date(calendarYear, calendarMonthIdx, 1).getDay() + 6) % 7;

  const calendarMonthLabel = calendarMonth.toLocaleString('uk-UA', {
    month: 'long',
    year: 'numeric',
  });

  const pubsByDay = publications.reduce<Record<string, Publication[]>>((acc, p) => {
    const dateStr = p.publishedAt || p.scheduledAt || p.createdAt;
    if (!dateStr) return acc;
    const d = new Date(dateStr);
    if (d.getFullYear() === calendarYear && d.getMonth() === calendarMonthIdx) {
      const key = String(d.getDate());
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
    }
    return acc;
  }, {});

  const prevMonth = () => setCalendarMonth(new Date(calendarYear, calendarMonthIdx - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarYear, calendarMonthIdx + 1, 1));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm transition-colors ${viewMode === 'list' ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-[var(--color-bg-secondary)]'}`}
            >
              {t('viewList')}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm transition-colors ${viewMode === 'calendar' ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-[var(--color-bg-secondary)]'}`}
            >
              {t('viewCalendar')}
            </button>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? t('cancel') : t('newPublication')}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('templateLabel')}</label>
              <select
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const tpl = PUBLICATION_TEMPLATES.find((tp) => tp.label === e.target.value);
                  if (tpl) applyTemplate(tpl);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>
                  {t('chooseTemplate')}
                </option>
                {PUBLICATION_TEMPLATES.map((tpl) => (
                  <option key={tpl.label} value={tpl.label}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Product picker */}
            <div>
              <label className="mb-1 block text-sm font-medium">{t('productLabel')}</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowProductPicker(!showProductPicker);
                  if (!showProductPicker) searchProducts('', 'all');
                }}
              >
                {showProductPicker ? t('hideProductPicker') : t('chooseProduct')}
              </Button>
              {showProductPicker && (
                <div className="mt-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <div className="flex overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
                      {(
                        [
                          ['all', t('filterAll')],
                          ['promo', t('filterPromo')],
                          ['new', t('filterNew')],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setProductFilter(key);
                            searchProducts(productSearch, key);
                          }}
                          className={`px-3 py-1 text-xs transition-colors ${productFilter === key ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-[var(--color-bg)]'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder={t('productSearchPh')}
                      className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-sm"
                    />
                    {productSearching && <Spinner size="sm" />}
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {productResults.map((p) => (
                      <div
                        key={p.id}
                        className="flex w-full items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-sm hover:bg-[var(--color-bg)] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(p.id)}
                          onChange={() => toggleBulkSelect(p.id)}
                          className="accent-[var(--color-primary)]"
                        />
                        <button
                          onClick={() => selectProduct(p)}
                          className="flex flex-1 items-center gap-3 text-left"
                        >
                          {p.imagePath ? (
                            <Image
                              src={p.imagePath}
                              alt=""
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-border)] text-xs">
                              📦
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">
                              {t('priceShort', { price: p.priceRetail })}
                              {p.isPromo && (
                                <span className="ml-1 text-[var(--color-danger)]">
                                  {t('promo')}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                    {productResults.length === 0 && !productSearching && (
                      <p className="py-2 text-center text-xs text-[var(--color-text-secondary)]">
                        {t('noProductsFound')}
                      </p>
                    )}
                  </div>
                  {bulkSelected.size > 0 && (
                    <div className="mt-2 flex items-center gap-2 border-t border-[var(--color-border)] pt-2">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {t('selectedCount', { count: bulkSelected.size })}
                      </span>
                      <Button size="sm" onClick={handleBulkPublish} isLoading={bulkPublishing}>
                        {t('publishAllSelected')}
                      </Button>
                      <button
                        onClick={() => setBulkSelected(new Set())}
                        className="text-xs text-[var(--color-text-secondary)] hover:underline"
                      >
                        {t('reset')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Input
              label={t('titleLabel')}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t('titlePh')}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t('textLabel')}</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={4}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                placeholder={t('textPh')}
              />
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-[var(--color-text-secondary)]">
                  {t('insert')}
                </span>
                {TEMPLATE_VARS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, content: f.content + v.key }))}
                    className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--color-bg-secondary)]"
                    title={v.label}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('channelsLabel')}</label>
              <ChannelCheckboxes
                channels={form.channels}
                onChange={(ch) =>
                  setForm((f) => ({ ...f, channels: toggleChannel(f.channels, ch) }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('imageLabel')}</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="text-sm file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-sm file:text-white"
                />
                {imageUploading && <Spinner size="sm" />}
                {form.imagePath && (
                  <div className="flex items-center gap-2">
                    <Image
                      src={form.imagePath}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imagePath: '' }))}
                      className="text-xs text-[var(--color-danger)]"
                    >
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>
              {/* Watermark toggle */}
              {form.imagePath && (
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useWatermark}
                    onChange={(e) => setUseWatermark(e.target.checked)}
                    className="accent-[var(--color-primary)]"
                  />
                  {t('addWatermark')}
                </label>
              )}
              {/* Additional images for carousel */}
              {form.imagePath && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {t('additionalImages')}
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/quicktime"
                      multiple
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files) return;
                        setImageUploading(true);
                        for (const file of Array.from(files)) {
                          const fd = new FormData();
                          fd.append('file', file);
                          fd.append('folder', 'publications');
                          const res = await apiClient.upload<{ path: string }>(
                            '/api/v1/admin/upload',
                            fd,
                          );
                          if (res.success && res.data) {
                            setAdditionalImages((prev) => [...prev, res.data!.path]);
                          }
                        }
                        setImageUploading(false);
                        e.target.value = '';
                      }}
                      className="text-xs file:mr-2 file:rounded-[var(--radius)] file:border-0 file:bg-[var(--color-bg-secondary)] file:px-2 file:py-1 file:text-xs"
                    />
                  </div>
                  {additionalImages.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {additionalImages.map((img, i) => (
                        <div key={i} className="relative">
                          <Image
                            src={img}
                            alt=""
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setAdditionalImages((prev) => prev.filter((_, j) => j !== i))
                            }
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[8px] text-white"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('hashtagsLabel')}
                value={form.hashtags}
                onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
                placeholder={t('hashtagsPh')}
              />
              <div>
                <label className="mb-1 block text-sm font-medium">{t('scheduleLabel')}</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  {[
                    { label: t('inOneHour'), hours: 1 },
                    { label: t('inThreeHours'), hours: 3 },
                    { label: t('tomorrow9'), preset: 'tomorrow9' },
                    { label: t('tomorrow18'), preset: 'tomorrow18' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        if (opt.hours) {
                          d.setHours(d.getHours() + opt.hours);
                        } else if (opt.preset === 'tomorrow9') {
                          d.setDate(d.getDate() + 1);
                          d.setHours(9, 0, 0, 0);
                        } else if (opt.preset === 'tomorrow18') {
                          d.setDate(d.getDate() + 1);
                          d.setHours(18, 0, 0, 0);
                        }
                        const iso = d.toISOString().slice(0, 16);
                        setForm((f) => ({ ...f, scheduledAt: iso }));
                      }}
                      className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--color-bg-secondary)]"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Per-channel content overrides */}
            <div>
              <button
                type="button"
                onClick={() => setShowChannelContents(!showChannelContents)}
                className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                <span>{showChannelContents ? '▼' : '▶'}</span>
                {t('perChannelContent')}
              </button>
              {showChannelContents && (
                <div className="mt-2 space-y-3">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('perChannelHint')}
                  </p>
                  {form.channels.map((ch) => {
                    const label = channelLabel(ch);
                    const cc = channelContents[ch] || { title: '', content: '', hashtags: '' };
                    const updateCC = (field: keyof ChannelContent, value: string) => {
                      setChannelContents((prev) => ({
                        ...prev,
                        [ch]: {
                          ...(prev[ch] || { title: '', content: '', hashtags: '' }),
                          [field]: value,
                        },
                      }));
                    };
                    return (
                      <div
                        key={ch}
                        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">{label}</span>
                          {(cc.title || cc.content || cc.hashtags) && (
                            <button
                              type="button"
                              onClick={() =>
                                setChannelContents((prev) => {
                                  const next = { ...prev };
                                  delete next[ch];
                                  return next;
                                })
                              }
                              className="text-xs text-[var(--color-danger)] hover:underline"
                            >
                              {t('reset')}
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <input
                            value={cc.title}
                            onChange={(e) => updateCC('title', e.target.value)}
                            placeholder={t('ccTitlePh', { main: form.title || t('ccTitleMain') })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                          <textarea
                            value={cc.content}
                            onChange={(e) => updateCC('content', e.target.value)}
                            placeholder={t('ccContentPh')}
                            rows={2}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                          <input
                            value={cc.hashtags}
                            onChange={(e) => updateCC('hashtags', e.target.value)}
                            placeholder={t('ccHashtagsPh', {
                              main: form.hashtags || t('ccHashtagsMain'),
                            })}
                            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Button onClick={handleCreate} isLoading={isSubmitting}>
              {form.scheduledAt ? t('schedule') : t('createDraft')}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : viewMode === 'list' ? (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium">{t('thTitle')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('thChannels')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('thStatus')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('thDate')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
                >
                  {editingId === p.id ? (
                    <td colSpan={5} className="p-4">
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                            placeholder={t('titleEditPh')}
                          />
                          <input
                            value={editForm.hashtags}
                            onChange={(e) => setEditForm({ ...editForm, hashtags: e.target.value })}
                            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                            placeholder={t('hashtagsEditPh')}
                          />
                        </div>
                        <textarea
                          value={editForm.content}
                          onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                          rows={3}
                        />
                        <div className="flex flex-wrap items-center gap-4">
                          <ChannelCheckboxes
                            channels={editForm.channels}
                            onChange={(ch) =>
                              setEditForm({
                                ...editForm,
                                channels: toggleChannel(editForm.channels, ch),
                              })
                            }
                          />
                          <input
                            type="datetime-local"
                            value={editForm.scheduledAt}
                            onChange={(e) =>
                              setEditForm({ ...editForm, scheduledAt: e.target.value })
                            }
                            className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
                          />
                          <div className="ml-auto flex gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-[var(--radius)] border border-[var(--color-border)] p-1.5"
                            >
                              <Close size={16} />
                            </button>
                            <button
                              onClick={() => saveEdit(p.id)}
                              className="rounded-[var(--radius)] bg-[var(--color-primary)] p-1.5 text-white"
                            >
                              <Check size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="font-medium">{p.title}</span>
                        <p className="line-clamp-1 text-xs text-[var(--color-text-secondary)]">
                          {p.content}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(p.channels as string[]).map((ch) => {
                            const cr = p.channelResults?.find((r) => r.channel === ch);
                            const icon = !cr
                              ? ''
                              : cr.status === 'published'
                                ? '✅'
                                : cr.status === 'failed'
                                  ? '❌'
                                  : '⏳';
                            return (
                              <span
                                key={ch}
                                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  cr?.status === 'failed'
                                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                    : cr?.status === 'published'
                                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                      : 'bg-[var(--color-bg-secondary)]'
                                }`}
                                title={cr?.errorMessage || ''}
                              >
                                {icon} {channelLabel(ch)}
                                {cr?.status === 'failed' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRetry(p.id, ch);
                                    }}
                                    className="ml-0.5 text-[9px] underline hover:no-underline"
                                    title={t('retryTitle', { error: cr.errorMessage || '' })}
                                  >
                                    ↻
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${statusColor(p.status)}`}
                        >
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatDate(p.publishedAt || p.scheduledAt || p.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewPub(p)}
                            className="rounded-[var(--radius)] border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]"
                            title={t('view')}
                          >
                            <Eye size={14} />
                          </button>
                          {p.status !== 'published' ? (
                            <>
                              <button
                                onClick={() => startEdit(p)}
                                className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                              >
                                {t('edit')}
                              </button>
                              <button
                                onClick={() => {
                                  const channel = p.channels?.[0];
                                  if (!channel) {
                                    toast.error(t('selectChannelFirst'));
                                    return;
                                  }
                                  setTestPub({ id: p.id, channel });
                                }}
                                className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
                                title={t('testTitle')}
                              >
                                {t('test')}
                              </button>
                              <Button size="sm" onClick={() => setPublishConfirmId(p.id)}>
                                {t('publish')}
                              </Button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="p-1 text-[var(--color-danger)]"
                              >
                                <Trash size={14} />
                              </button>
                            </>
                          ) : (
                            // Fully published: re-publishing 409s, so no
                            // row-level retry button. Per-channel retry of a
                            // failed channel is available in the publication
                            // details view.
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {statusLabel(p.status)}
                            </span>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {publications.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                      <span className="text-3xl" aria-hidden="true">
                        📢
                      </span>
                      <p className="text-sm font-medium">{t('emptyTitle')}</p>
                      <p className="text-xs">{t('emptyHint')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ---------- Calendar View ---------- */
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          {/* Calendar header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <button
              onClick={prevMonth}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              &larr;
            </button>
            <span className="text-sm font-semibold capitalize">{calendarMonthLabel}</span>
            <button
              onClick={nextMonth}
              className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              &rarr;
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {[
              t('dow_mon'),
              t('dow_tue'),
              t('dow_wed'),
              t('dow_thu'),
              t('dow_fri'),
              t('dow_sat'),
              t('dow_sun'),
            ].map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center text-xs font-medium text-[var(--color-text-secondary)]"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[80px] border-b border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30"
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayKey = String(day);
              const dayPubs = pubsByDay[dayKey] || [];
              const isSelected = selectedDay === dayKey;
              const isToday =
                new Date().getFullYear() === calendarYear &&
                new Date().getMonth() === calendarMonthIdx &&
                new Date().getDate() === day;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                  className={`min-h-[80px] cursor-pointer border-b border-r border-[var(--color-border)] p-1 transition-colors hover:bg-[var(--color-bg-secondary)] ${isSelected ? 'bg-[var(--color-primary)]/5 ring-1 ring-inset ring-[var(--color-primary)]' : ''}`}
                >
                  <div
                    className={`mb-0.5 text-xs font-medium ${isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}
                  >
                    {day}
                  </div>
                  {dayPubs.slice(0, 3).map((pub) => (
                    <div
                      key={pub.id}
                      className={`mb-0.5 truncate rounded px-1 text-[10px] leading-tight ${statusColor(pub.status)}`}
                      title={pub.title}
                    >
                      {pub.title}
                    </div>
                  ))}
                  {dayPubs.length > 3 && (
                    <div className="px-1 text-[10px] text-[var(--color-text-secondary)]">
                      {t('moreCount', { count: dayPubs.length - 3 })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected day detail panel */}
          {selectedDay && (
            <div className="border-t border-[var(--color-border)] p-4">
              <h3 className="mb-2 text-sm font-semibold">
                {Number(selectedDay)} {calendarMonth.toLocaleString('uk-UA', { month: 'long' })}{' '}
                {calendarYear}
              </h3>
              {(pubsByDay[selectedDay] || []).length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">{t('noPubsThisDay')}</p>
              ) : (
                <div className="space-y-2">
                  {(pubsByDay[selectedDay] || []).map((pub) => (
                    <div
                      key={pub.id}
                      className="flex items-start justify-between rounded-[var(--radius)] border border-[var(--color-border)] p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{pub.title}</p>
                        <p className="line-clamp-1 text-xs text-[var(--color-text-secondary)]">
                          {pub.content}
                        </p>
                        <div className="mt-1 flex gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] ${statusColor(pub.status)}`}
                          >
                            {statusLabel(pub.status)}
                          </span>
                          <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[10px]">
                            {pub.channels.join(', ')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPreviewPub(pub)}
                          className="rounded-[var(--radius)] border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-secondary)]"
                          title={t('view')}
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <Modal isOpen={!!previewPub} onClose={() => setPreviewPub(null)} size="md">
        {previewPub && (
          <div className="p-6">
            <h3 className="mb-2 text-lg font-bold">{previewPub.title}</h3>
            <div className="mb-4 space-y-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${statusColor(previewPub.status)}`}
              >
                {statusLabel(previewPub.status)}
              </span>
              {previewPub.channelResults && previewPub.channelResults.length > 0 && (
                <div className="space-y-1">
                  {previewPub.channelResults.map((cr) => (
                    <div key={cr.channel} className="flex items-center gap-2 text-xs">
                      <span>
                        {cr.status === 'published' ? '✅' : cr.status === 'failed' ? '❌' : '⏳'}
                      </span>
                      <span className="font-medium">{channelLabel(cr.channel)}</span>
                      {cr.permalink && (
                        <a
                          href={cr.permalink}
                          target="_blank"
                          rel="noopener"
                          className="text-[var(--color-primary)] underline"
                        >
                          {t('link')}
                        </a>
                      )}
                      {cr.errorMessage && (
                        <span className="text-[var(--color-danger)]">{cr.errorMessage}</span>
                      )}
                      {cr.status === 'failed' && (
                        <button
                          onClick={() => {
                            handleRetry(previewPub.id, cr.channel);
                            setPreviewPub(null);
                          }}
                          className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--color-bg-secondary)]"
                        >
                          {t('retry')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Analytics */}
            {previewPub.status === 'published' &&
              previewPub.channelResults &&
              previewPub.channelResults.some((cr) => cr.views || cr.clicks) && (
                <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                  <div className="mb-2 text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">
                    {t('analytics')}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold">
                        {previewPub.channelResults.reduce((s, cr) => s + (cr.views || 0), 0)}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]">
                        {t('views')}
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {previewPub.channelResults.reduce((s, cr) => s + (cr.clicks || 0), 0)}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]">
                        {t('clicks')}
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {(() => {
                          const withEng = previewPub.channelResults.filter(
                            (cr) => cr.engagement != null,
                          );
                          return withEng.length > 0
                            ? (
                                withEng.reduce((s, cr) => s + (cr.engagement || 0), 0) /
                                withEng.length
                              ).toFixed(1) + '%'
                            : '—';
                        })()}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]">
                        {t('engagement')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {previewPub.channelResults
                      .filter((cr) => cr.status === 'published')
                      .map((cr) => (
                        <div key={cr.channel} className="flex items-center justify-between text-xs">
                          <span className="font-medium">{channelLabel(cr.channel)}</span>
                          <span className="text-[var(--color-text-secondary)]">
                            {t('channelStats', {
                              views: cr.views ?? '—',
                              clicks: cr.clicks ?? '—',
                              engagement:
                                cr.engagement != null ? `${cr.engagement.toFixed(1)}%` : '—',
                            })}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Per-channel preview */}
            <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
              <div className="mb-2 text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">
                {t('previewByChannel')}
              </div>
              <div className="space-y-2 text-sm">
                {previewPub.channels.map((ch) => {
                  const label = channelLabel(ch);
                  const cc = previewPub.channelContents?.[ch];
                  const title = cc?.title || previewPub.title;
                  const content = cc?.content || previewPub.content;
                  const hashtags =
                    cc?.hashtags !== undefined && cc?.hashtags ? cc.hashtags : previewPub.hashtags;
                  const hasOverride = !!(cc?.title || cc?.content || cc?.hashtags);

                  if (ch === 'telegram') {
                    return (
                      <div key={ch} className="rounded bg-[var(--color-bg)] p-2">
                        <div className="mb-1 flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                          {label} (HTML){' '}
                          {hasOverride && (
                            <span className="rounded bg-blue-100 px-1 text-blue-600">custom</span>
                          )}
                        </div>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(
                              `<b>${title}</b><br/><br/>${content.replace(/\n/g, '<br/>')}${hashtags ? `<br/><br/>${hashtags}` : ''}`,
                            ),
                          }}
                        />
                      </div>
                    );
                  }
                  if (ch === 'instagram' || ch === 'tiktok') {
                    const fullText = `${title}\n\n${content}${hashtags ? `\n\n${hashtags}` : ''}`;
                    return (
                      <div key={ch} className="rounded bg-[var(--color-bg)] p-2">
                        <div className="mb-1 flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                          {label} ({fullText.length}/2200){' '}
                          {hasOverride && (
                            <span className="rounded bg-blue-100 px-1 text-blue-600">custom</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{fullText}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={ch} className="rounded bg-[var(--color-bg)] p-2">
                      <div className="mb-1 flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                        {label}{' '}
                        {hasOverride && (
                          <span className="rounded bg-blue-100 px-1 text-blue-600">custom</span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">
                        <strong>{title}</strong>
                        {'\n\n'}
                        {content}
                        {hashtags ? `\n\n${hashtags}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--color-text-secondary)]">
                <p>{t('author', { name: previewPub.creator.fullName })}</p>
                <p>{t('createdLabel', { date: formatDate(previewPub.createdAt) })}</p>
                {previewPub.scheduledAt && (
                  <p>{t('scheduledLabel', { date: formatDate(previewPub.scheduledAt) })}</p>
                )}
                {previewPub.publishedAt && (
                  <p>{t('publishedLabel', { date: formatDate(previewPub.publishedAt) })}</p>
                )}
              </div>
              {previewPub.status === 'published' && (
                <button
                  onClick={async () => {
                    await apiClient.post(`/api/v1/admin/publications/${previewPub.id}/analytics`);
                    loadPublications();
                    setPreviewPub(null);
                  }}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-secondary)]"
                >
                  {t('refreshAnalytics')}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Publish confirmation */}
      {publishConfirmId !== null &&
        (() => {
          const pub = publications.find((p) => p.id === publishConfirmId);
          if (!pub) return null;
          return (
            <Modal isOpen onClose={() => setPublishConfirmId(null)} size="sm">
              <div className="p-6">
                <h3 className="mb-3 text-lg font-bold">{t('confirmPublishTitle')}</h3>
                <p className="mb-2 text-sm">
                  {t('confirmPublishPre')}
                  <strong>{pub.title}</strong>
                  {t('confirmPublishPost')}
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {pub.channels.map((ch) => (
                    <span
                      key={ch}
                      className="rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-sm font-medium"
                    >
                      {channelLabel(ch)}
                    </span>
                  ))}
                </div>
                {pub.channelContents && Object.keys(pub.channelContents).length > 0 && (
                  <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                    {t('perChannelNote', { count: Object.keys(pub.channelContents).length })}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setPublishConfirmId(null)}>
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={() => {
                      handlePublish(pub.id);
                      setPublishConfirmId(null);
                    }}
                  >
                    {t('publish')}
                  </Button>
                </div>
              </div>
            </Modal>
          );
        })()}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        variant="danger"
        message={t('deleteConfirm')}
      />

      {/* Test render modal — fires the /test endpoint when state is set, then
          shows the rendered output so the operator can verify {{product.*}}
          placeholders without actually publishing. */}
      {testPub &&
        (() => {
          if (!testResult && !isTesting) {
            setIsTesting(true);
            apiClient
              .post<typeof testResult>(`/api/v1/admin/publications/${testPub.id}/test`, {
                channel: testPub.channel,
              })
              .then((res) => {
                if (res.success && res.data) setTestResult(res.data);
                else toast.error(res.error || t('testError'));
              })
              .finally(() => setIsTesting(false));
          }
          return (
            <Modal
              isOpen
              onClose={() => {
                setTestPub(null);
                setTestResult(null);
              }}
              size="md"
            >
              <h3 className="mb-3 text-lg font-semibold">{t('testRender')}</h3>
              {isTesting && !testResult && (
                <p className="text-sm text-[var(--color-text-secondary)]">{t('rendering')}</p>
              )}
              {testResult && (
                <div className="space-y-3 text-sm">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('channelColon')} <strong>{testResult.channel}</strong>
                  </p>
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                      {t('headingLabel')}
                    </p>
                    <p className="rounded bg-[var(--color-bg-secondary)] p-2">{testResult.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                      {t('contentLabel')}
                    </p>
                    <p className="whitespace-pre-wrap rounded bg-[var(--color-bg-secondary)] p-2">
                      {testResult.content}
                    </p>
                  </div>
                  {testResult.hashtags && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                        {t('hashtagsLabel')}
                      </p>
                      <p className="rounded bg-[var(--color-bg-secondary)] p-2 text-[var(--color-primary)]">
                        {testResult.hashtags}
                      </p>
                    </div>
                  )}
                  {testResult.note && (
                    <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {testResult.note}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTestPub(null);
                    setTestResult(null);
                  }}
                >
                  {t('close')}
                </Button>
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}
