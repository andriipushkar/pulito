'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { todayKyivIso } from '@/utils/format';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import AuditDiff from '@/components/admin/AuditDiff';

interface AuditEntry {
  id: number;
  actionType: string;
  entityType: string | null;
  entityId: number | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { fullName: string | null; email: string } | null;
}

// Critical actions get red, sensitive ones amber, everything else neutral.
// Color is the only place we encode severity — keep labels uniform.
const ACTION_BADGE: Record<string, string> = {
  data_delete: 'bg-red-100 text-red-700',
  user_block: 'bg-red-100 text-red-700',
  role_change: 'bg-red-100 text-red-700',
  password_reset: 'bg-amber-100 text-amber-700',
  user_unblock: 'bg-amber-100 text-amber-700',
  rule_change: 'bg-amber-100 text-amber-700',
  login: 'bg-emerald-50 text-emerald-700',
  logout: 'bg-slate-100 text-slate-600',
};

// Anchor presets on the Kyiv calendar day so they line up with the server's
// Kyiv-based date filter — plain toISOString() is the UTC day, which is still
// "yesterday" between midnight and 03:00 Kyiv.
function todayIso(): string {
  return todayKyivIso();
}
function isoDaysAgo(days: number): string {
  const d = new Date(`${todayKyivIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

interface UserOption {
  id: number;
  fullName: string | null;
  email: string;
}

function UserPicker({
  value,
  label,
  onChange,
}: {
  value: number | null;
  label: string;
  onChange: (id: number | null, label: string) => void;
}) {
  const t = useTranslations('admin.auditLogPage');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Debounced search — 250ms idle before hitting the existing /admin/users API.
  // Render-time guard below means short queries never show stale results,
  // so we can avoid an unconditional setResults([]) in the effect body.
  const trimmedQuery = query.trim();
  const isQueryActive = value === null && trimmedQuery.length >= 2;
  useEffect(() => {
    if (!isQueryActive) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<UserOption[]>(
          `/api/v1/admin/users?search=${encodeURIComponent(trimmedQuery)}&limit=10`,
        );
        if (cancelled) return;
        if (res.success && res.data) setResults(res.data);
        else setResults([]);
        setOpen(true);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, isQueryActive]);
  const visibleResults = isQueryActive ? results : [];

  if (value !== null) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium">{t('userLabel')}</label>
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm">
          <span className="truncate">{label}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null, '');
              setQuery('');
              setResults([]);
            }}
            className="ml-auto text-xs text-[var(--color-danger)] hover:underline"
            title={t('resetTitle')}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium">{t('userLabel')}</label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => visibleResults.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('userSearchPh')}
        className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
      />
      {open && (visibleResults.length > 0 || loading) && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
              {t('userSearching')}
            </li>
          )}
          {visibleResults.map((u) => {
            const display = u.fullName ? `${u.fullName} (${u.email})` : u.email;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(u.id, display);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                >
                  {display}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminAuditLogPage() {
  const t = useTranslations('admin.auditLogPage');
  const ACTION_OPTIONS = [
    { value: '', label: t('actionAll') },
    { value: 'login', label: t('actionLogin') },
    { value: 'logout', label: t('actionLogout') },
    { value: 'order_status_change', label: t('actionOrderStatus') },
    { value: 'import', label: t('actionImport') },
    { value: 'role_change', label: t('actionRoleChange') },
    { value: 'publication_create', label: t('actionPublication') },
    { value: 'theme_change', label: t('actionThemeChange') },
    { value: 'page_edit', label: t('actionPageEdit') },
    { value: 'data_delete', label: t('actionDataDelete') },
    { value: 'user_block', label: t('actionUserBlock') },
    { value: 'user_unblock', label: t('actionUserUnblock') },
    { value: 'user_edit', label: t('actionUserEdit') },
    { value: 'password_reset', label: t('actionPasswordReset') },
    { value: 'wholesale_approve', label: t('actionWholesaleApprove') },
    { value: 'wholesale_reject', label: t('actionWholesaleReject') },
  ];
  const ENTITY_OPTIONS = [
    { value: '', label: t('entityAll') },
    { value: 'order', label: t('entityOrder') },
    { value: 'product', label: t('entityProduct') },
    { value: 'user', label: t('entityUser') },
    { value: 'category', label: t('entityCategory') },
    { value: 'page', label: t('entityPage') },
    { value: 'blog_post', label: t('entityBlogPost') },
    { value: 'blog_category', label: t('entityBlogCategory') },
    { value: 'banner', label: t('entityBanner') },
    { value: 'brand', label: t('entityBrand') },
    { value: 'theme', label: t('entityTheme') },
    { value: 'wholesale_rule', label: t('entityWholesaleRule') },
    { value: 'settings', label: t('entitySettings') },
    { value: 'product_bulk', label: t('entityProductBulk') },
  ];
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ipSearch, setIpSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(20);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [userIdFilter, setUserIdFilter] = useState<number | null>(null);
  const [userLabel, setUserLabel] = useState('');
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // isLoading is derived from a request key vs the last completed key so we
  // never need a synchronous setIsLoading(true) inside the fetch effect.
  const requestKey = `${page}|${limit}|${actionFilter}|${entityFilter}|${dateFrom}|${dateTo}|${ipSearch}|${userIdFilter}`;
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  const isLoading = completedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actionFilter) params.set('actionType', actionFilter);
    if (entityFilter) params.set('entityType', entityFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (ipSearch) params.set('ipAddress', ipSearch);
    if (userIdFilter !== null) params.set('userId', String(userIdFilter));

    apiClient
      .get<AuditEntry[]>(`/api/v1/admin/audit-log?${params}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setLogs(res.data);
          setTotal(res.pagination?.total ?? 0);
        } else {
          toast.error(res.error || t('loadError'));
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setCompletedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [
    page,
    limit,
    actionFilter,
    entityFilter,
    dateFrom,
    dateTo,
    ipSearch,
    userIdFilter,
    requestKey,
    t,
  ]);

  const resetFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setDateFrom('');
    setDateTo('');
    setIpSearch('');
    setUserIdFilter(null);
    setUserLabel('');
    setPage(1);
  };

  const exportCsv = () => {
    const qs = new URLSearchParams();
    if (actionFilter) qs.set('actionType', actionFilter);
    if (entityFilter) qs.set('entityType', entityFilter);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    if (ipSearch) qs.set('ipAddress', ipSearch);
    if (userIdFilter !== null) qs.set('userId', String(userIdFilter));
    const search = qs.toString();
    window.location.href = `/api/v1/admin/audit-log/export${search ? `?${search}` : ''}`;
  };

  const hasActiveFilters =
    actionFilter || entityFilter || dateFrom || dateTo || ipSearch || userIdFilter !== null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? t('hideFilters') : t('filters')}
            {hasActiveFilters ? ' *' : ''}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t('quickSelect')}
            </span>
            {[
              { label: t('today'), from: todayIso(), to: todayIso() },
              { label: t('days7'), from: isoDaysAgo(6), to: todayIso() },
              { label: t('days30'), from: isoDaysAgo(29), to: todayIso() },
              { label: t('days90'), from: isoDaysAgo(89), to: todayIso() },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setDateFrom(preset.from);
                  setDateTo(preset.to);
                  setPage(1);
                }}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs hover:bg-[var(--color-bg)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium">{t('actionTypeLabel')}</label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t('entityTypeLabel')}</label>
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
              >
                {ENTITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('dateFromLabel')}
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
            <Input
              label={t('dateToLabel')}
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
            <Input
              label={t('ipLabel')}
              value={ipSearch}
              onChange={(e) => {
                setIpSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('ipPh')}
            />
            <UserPicker
              value={userIdFilter}
              label={userLabel}
              onChange={(id, lbl) => {
                setUserIdFilter(id);
                setUserLabel(lbl);
                setPage(1);
              }}
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="mt-3 text-xs text-[var(--color-primary)] hover:underline"
            >
              {t('resetFilters')}
            </button>
          )}
        </div>
      )}

      {(() => {
        const columns: AdminTableColumn<AuditEntry>[] = [
          {
            key: 'date',
            header: t('colDate'),
            render: (log) => (
              <span className="text-xs whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString('uk-UA')}
              </span>
            ),
          },
          {
            key: 'user',
            header: t('colUser'),
            render: (log) => (
              <span className="text-xs">
                {log.user?.fullName || log.user?.email || t('system')}
              </span>
            ),
          },
          {
            key: 'action',
            header: t('colAction'),
            render: (log) => (
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  ACTION_BADGE[log.actionType] ?? 'bg-[var(--color-bg-secondary)]'
                }`}
              >
                {ACTION_OPTIONS.find((a) => a.value === log.actionType)?.label || log.actionType}
              </span>
            ),
          },
          {
            key: 'entity',
            header: t('colEntity'),
            render: (log) => (
              <span className="text-xs">
                {log.entityType ? `${log.entityType} #${log.entityId}` : '—'}
              </span>
            ),
            hideOnMobile: true,
          },
          {
            key: 'ip',
            header: t('colIp'),
            render: (log) => (
              <span className="text-xs text-[var(--color-text-secondary)]">
                {log.ipAddress || '—'}
              </span>
            ),
            hideOnMobile: true,
          },
          {
            key: 'details',
            header: t('colDetails'),
            render: (log) => {
              const detailsStr = log.details ? JSON.stringify(log.details) : '';
              const isExpanded = expandedRows.has(log.id);
              if (!detailsStr) return <span className="text-xs">—</span>;
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRow(log.id);
                  }}
                  className="text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                  title={isExpanded ? t('collapse') : t('expand')}
                >
                  <span className="truncate block max-w-[180px]">{detailsStr}</span>
                </button>
              );
            },
          },
        ];

        return (
          <>
            <AdminTable
              columns={columns}
              rows={logs}
              rowKey={(log) => log.id}
              isLoading={isLoading}
              emptyState={
                <div className="flex flex-col items-center gap-3 py-6">
                  <span className="text-3xl" aria-hidden="true">
                    📋
                  </span>
                  <p className="text-sm font-medium">
                    {hasActiveFilters ? t('emptyFiltered') : t('emptyAll')}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {t('resetAll')}
                    </button>
                  )}
                </div>
              }
              pagination={{
                page,
                limit,
                total,
                onPageChange: setPage,
                onLimitChange: (size) => {
                  setLimit(size);
                  setPage(1);
                },
              }}
            />
            {/* Expanded detail rows under the table (kept outside AdminTable
                so generic table doesn't need to know about row expansion). */}
            {logs.some((l) => expandedRows.has(l.id)) && (
              <div className="mt-2 space-y-2">
                {logs
                  .filter((l) => expandedRows.has(l.id) && l.details)
                  .map((l) => (
                    <div
                      key={`exp-${l.id}`}
                      className="rounded-[var(--radius)] border border-[var(--color-border)]/40 bg-[var(--color-bg-secondary)]/60 px-4 py-3"
                    >
                      <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        {t('detailsPrefix', { id: l.id })}
                      </p>
                      <AuditDiff details={l.details} />
                    </div>
                  ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
