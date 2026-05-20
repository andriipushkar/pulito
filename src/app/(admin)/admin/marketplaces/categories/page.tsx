'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

interface Category {
  id: number;
  name: string;
  parentId: number | null;
}

interface CategoryMappingEntry {
  externalId: string;
  externalName?: string;
}
type CategoryMapping = Record<string, CategoryMappingEntry>;

interface CategoryCoverage {
  platform: string;
  totalCategories: number;
  mappedCategories: number;
  totalActiveProducts: number;
  productsWithMapping: number;
  productsWithoutMapping: number;
  uncategorizedProducts: number;
  unmappedCategoryIds: number[];
}

const MARKETPLACES = [
  { key: 'olx', name: 'OLX', icon: '🟢' },
  { key: 'rozetka', name: 'Rozetka', icon: '🟩' },
  { key: 'prom', name: 'Prom.ua', icon: '🔵' },
  { key: 'epicentrk', name: 'Epicentr K', icon: '🟠' },
] as const;

type PlatformKey = (typeof MARKETPLACES)[number]['key'];

const EMPTY_MAPPINGS: Record<PlatformKey, CategoryMapping> = {
  olx: {},
  rozetka: {},
  prom: {},
  epicentrk: {},
};

export default function MarketplaceCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<Record<PlatformKey, CategoryMapping>>(EMPTY_MAPPINGS);
  const [coverage, setCoverage] = useState<Record<PlatformKey, CategoryCoverage | undefined>>({
    olx: undefined,
    rozetka: undefined,
    prom: undefined,
    epicentrk: undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingFor, setSavingFor] = useState<PlatformKey | null>(null);
  const [copyingTo, setCopyingTo] = useState<PlatformKey | null>(null);
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('rozetka');
  const [search, setSearch] = useState('');
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<Category[]>('/api/v1/admin/categories'),
      Promise.all(
        MARKETPLACES.map((m) =>
          apiClient.get<CategoryMapping>(`/api/v1/admin/marketplaces/${m.key}/category-map`),
        ),
      ),
      apiClient.get<CategoryCoverage[]>('/api/v1/admin/marketplaces/categories/coverage'),
    ]).then(([catsRes, mapResults, coverageRes]) => {
      if (cancelled) return;
      if (catsRes.success && catsRes.data) setCategories(catsRes.data);

      const next: Record<PlatformKey, CategoryMapping> = { olx: {}, rozetka: {}, prom: {}, epicentrk: {} };
      MARKETPLACES.forEach((m, i) => {
        const r = mapResults[i];
        if (r.success && r.data) next[m.key] = r.data;
      });
      setMappings(next);

      if (coverageRes.success && Array.isArray(coverageRes.data)) {
        const covMap: Record<PlatformKey, CategoryCoverage | undefined> = {
          olx: undefined,
          rozetka: undefined,
          prom: undefined,
          epicentrk: undefined,
        };
        for (const c of coverageRes.data) {
          if (MARKETPLACES.some((m) => m.key === c.platform)) {
            covMap[c.platform as PlatformKey] = c;
          }
        }
        setCoverage(covMap);
      }

      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const updateEntry = (
    platform: PlatformKey,
    localId: number,
    patch: Partial<CategoryMappingEntry>,
  ) => {
    setMappings((prev) => {
      const platformMap = { ...(prev[platform] || {}) };
      const existing = platformMap[String(localId)] || { externalId: '' };
      platformMap[String(localId)] = { ...existing, ...patch };
      return { ...prev, [platform]: platformMap };
    });
  };

  const handleSave = async (platform: PlatformKey) => {
    setSavingFor(platform);
    const res = await apiClient.put(
      `/api/v1/admin/marketplaces/${platform}/category-map`,
      mappings[platform],
    );
    if (res.success) {
      toast.success(`${MARKETPLACES.find((m) => m.key === platform)?.name}: збережено`);
      setReloadToken((n) => n + 1);
    } else {
      toast.error(res.error || 'Помилка збереження');
    }
    setSavingFor(null);
  };

  const handleCopyFrom = async (from: PlatformKey) => {
    if (from === activePlatform) return;
    if (!confirm(`Скопіювати mapping з ${MARKETPLACES.find((m) => m.key === from)?.name} в ${MARKETPLACES.find((m) => m.key === activePlatform)?.name}? Існуючі записи не перезаписуються.`)) {
      return;
    }
    setCopyingTo(activePlatform);
    const res = await apiClient.post<{ copied: number; total: number }>(
      '/api/v1/admin/marketplaces/categories/copy',
      { from, to: activePlatform, overwrite: false },
    );
    if (res.success && res.data) {
      toast.success(`Скопійовано ${res.data.copied} записів (всього: ${res.data.total})`);
      setReloadToken((n) => n + 1);
    } else {
      toast.error(res.error || 'Помилка копіювання');
    }
    setCopyingTo(null);
  };

  const renderCategoryName = (cat: Category): string => {
    if (!cat.parentId) return cat.name;
    const parent = categories.find((c) => c.id === cat.parentId);
    return parent ? `${parent.name} → ${cat.name}` : cat.name;
  };

  const unmappedSet = useMemo(
    () => new Set(coverage[activePlatform]?.unmappedCategoryIds || []),
    [coverage, activePlatform],
  );

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((cat) => {
      if (showOnlyUnmapped && !unmappedSet.has(cat.id)) return false;
      if (!q) return true;
      return renderCategoryName(cat).toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, search, showOnlyUnmapped, unmappedSet]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  const activeCoverage = coverage[activePlatform];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/marketplaces"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Маркетплейси
        </Link>
        <h2 className="mt-1 text-xl font-bold">Mapping категорій</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Зіставте локальні категорії з ID категорій на маркетплейсах. Товари без mapping публікуються в дефолтну категорію — це часто причина відхилення лістингів.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {MARKETPLACES.map((m) => {
          const cov = coverage[m.key];
          const pct = cov && cov.totalActiveProducts > 0
            ? Math.round((cov.productsWithMapping / cov.totalActiveProducts) * 100)
            : 0;
          return (
            <button
              key={m.key}
              onClick={() => setActivePlatform(m.key)}
              className={`rounded-[var(--radius)] border p-3 text-left transition-colors ${
                activePlatform === m.key
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{m.icon}</span>
                <span className="font-medium">{m.name}</span>
              </div>
              {cov && (
                <div className="mt-2 space-y-1 text-[11px] text-[var(--color-text-secondary)]">
                  <div>
                    Покриття: <strong className={pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}>{pct}%</strong>
                  </div>
                  <div>
                    {cov.productsWithMapping} / {cov.totalActiveProducts} товарів
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                    <div
                      className={`h-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {activeCoverage && activeCoverage.productsWithoutMapping > 0 && (
        <div className="mb-4 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ <strong>{activeCoverage.productsWithoutMapping}</strong> активних товарів зі
          <strong> {activeCoverage.unmappedCategoryIds.length}</strong> категорій не мають mapping
          на {MARKETPLACES.find((m) => m.key === activePlatform)?.name} — вони впадуть у дефолтну
          категорію (можуть бути відхилені маркетплейсом).{' '}
          <button
            onClick={() => setShowOnlyUnmapped(true)}
            className="font-semibold underline"
          >
            Показати тільки немапнуті
          </button>
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold">
            {MARKETPLACES.find((m) => m.key === activePlatform)?.name}
          </p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук категорії..."
            className="w-56"
          />
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showOnlyUnmapped}
              onChange={(e) => setShowOnlyUnmapped(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Тільки немапнуті з товарами
          </label>
          <div className="ml-auto flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) handleCopyFrom(e.target.value as PlatformKey);
                e.target.value = '';
              }}
              defaultValue=""
              disabled={copyingTo !== null}
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
            >
              <option value="" disabled>
                Скопіювати з…
              </option>
              {MARKETPLACES.filter((m) => m.key !== activePlatform).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.icon} {m.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              isLoading={savingFor === activePlatform}
              onClick={() => handleSave(activePlatform)}
            >
              Зберегти
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
                <th className="px-2 py-2">Локальна категорія</th>
                <th className="px-2 py-2">ID на маркетплейсі</th>
                <th className="px-2 py-2">Назва (опц., для довідки)</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat) => {
                const entry = mappings[activePlatform]?.[String(cat.id)] || { externalId: '' };
                const isUnmappedWithProducts = unmappedSet.has(cat.id);
                return (
                  <tr
                    key={cat.id}
                    className={`border-b border-[var(--color-border)] last:border-0 ${
                      isUnmappedWithProducts ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="px-2 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{renderCategoryName(cat)}</span>
                        {isUnmappedWithProducts && (
                          <span
                            className="text-[10px] text-amber-700"
                            title="Є активні товари без mapping — впадуть у дефолтну"
                          >
                            ⚠
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]">
                        ID: {cat.id}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        value={entry.externalId}
                        onChange={(e) =>
                          updateEntry(activePlatform, cat.id, { externalId: e.target.value })
                        }
                        placeholder="напр. 1430"
                        className="w-32"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        value={entry.externalName || ''}
                        onChange={(e) =>
                          updateEntry(activePlatform, cat.id, { externalName: e.target.value })
                        }
                        placeholder="Побутова хімія"
                        className="w-64"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCategories.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {search || showOnlyUnmapped
                ? 'Нічого не знайдено за фільтром'
                : 'Немає категорій'}
            </p>
          )}
        </div>

        <p className="mt-3 text-[10px] text-[var(--color-text-secondary)]">
          Залиште поле порожнім, щоб не мапити цю категорію. Натисніть «Зберегти», щоб
          застосувати зміни.
        </p>
      </div>
    </div>
  );
}
